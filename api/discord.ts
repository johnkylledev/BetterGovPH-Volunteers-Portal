import { createClient } from '@supabase/supabase-js';

const generateUniqueMemberId = async (client: any, selectedYear: number) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await client
      .from('users')
      .select('member_id')
      .ilike('member_id', `BGPH-${selectedYear}-%`)
      .order('member_id', { ascending: false })
      .limit(100);

    if (error) throw error;

    let maxSequence = 0;
    for (const u of data ?? []) {
      const memberId = u.member_id;
      if (typeof memberId !== 'string') continue;
      const match = memberId.match(/^BGPH-(\d{4})-(\d{3})$/);
      if (match && parseInt(match[1]) === selectedYear) {
        const seq = parseInt(match[2], 10);
        if (!isNaN(seq) && seq > maxSequence) maxSequence = seq;
      }
    }

    const nextSequence = maxSequence + 1;
    const newMemberId = `BGPH-${selectedYear}-${String(nextSequence).padStart(3, '0')}`;

    const { data: checkDuplicate } = await client
      .from('users')
      .select('member_id')
      .eq('member_id', newMemberId)
      .maybeSingle();

    if (!checkDuplicate) {
      return newMemberId;
    }
  }

  throw new Error('Failed to generate unique member ID after 5 attempts');
};

const ensureUserHasMemberId = async (client: any, uid: string) => {
  const { data, error } = await client
    .from('users')
    .select('member_id, year_joined')
    .eq('uid', uid)
    .maybeSingle();

  if (error) throw error;
  if (data?.member_id) return data.member_id as string;

  const yearJoined = data?.year_joined || new Date().getFullYear();
  const memberId = await generateUniqueMemberId(client, yearJoined);
  await client
    .from('users')
    .update({ member_id: memberId, updated_at: new Date().toISOString() })
    .eq('uid', uid);

  return memberId;
};

const getConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  serviceKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    '',
  bettygoKey: process.env.BETTYGO_API_KEY || '',
  bettygoBaseUrl: (process.env.BETTYGO_BASE_URL || 'https://bg.zel.kim').replace(/\/$/, ''),
  callbackUrl: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/discord-callback',
  discordBotToken: process.env.DISCORD_BOT_TOKEN || '',
});

const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const authenticateUser = async (supabase: any, token: string) => {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const uid = authData?.user?.id ? String(authData.user.id) : '';
    if (authError || !uid) {
      return null;
    }
    return uid;
  } catch {
    return null;
  }
};

const resolveDiscordProfile = async (discordId: string, botToken: string): Promise<{ username: string | null; displayName: string | null; avatar: string | null } | null> => {
  if (!botToken || !discordId) return null;
  try {
    const res = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { username?: string; global_name?: string | null; avatar?: string | null };
    return {
      username: data?.username ?? null,
      displayName: data?.global_name ?? null,
      avatar: data?.avatar ?? null,
    };
  } catch {
    return null;
  }
};

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    const { url: supabaseUrl, serviceKey, bettygoKey, bettygoBaseUrl, callbackUrl, discordBotToken } = getConfig();

    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: 'Server not configured' });
      return;
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = getBearerToken(req.headers?.authorization);
    if (!token && req.method !== 'GET') {
      res.status(401).json({ error: 'Missing Authorization bearer token' });
      return;
    }

    const uid = token ? await authenticateUser(supabase, token) : null;

    if (req.method === 'GET') {
      if (!bettygoKey) {
        res.status(200).json({ connected: false });
        return;
      }

      if (!uid) {
        res.status(401).json({ error: 'Missing Authorization bearer token' });
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('discord_id, discord_username, discord_display_name, discord_avatar')
        .eq('uid', uid)
        .maybeSingle();

      const discordId = userData?.discord_id;
      const discordUsername = userData?.discord_username ?? null;
      let discordDisplayName = userData?.discord_display_name ?? null;
      let discordAvatar = userData?.discord_avatar ?? null;
      if (!discordId) {
        res.status(200).json({ connected: false });
        return;
      }

      let resolvedUsername = discordUsername;
      if (!resolvedUsername) {
        const profile = await resolveDiscordProfile(discordId, discordBotToken);
        if (profile) {
          resolvedUsername = profile.username;
          discordDisplayName = profile.displayName;
          discordAvatar = profile.avatar;
          await supabase.from('users').update({
            discord_username: profile.username,
            discord_display_name: profile.displayName,
            discord_avatar: profile.avatar,
            updated_at: new Date().toISOString(),
          }).eq('uid', uid);
        }
      }

      const bettygoRes = await fetch(`${bettygoBaseUrl}/users/${discordId}/discord`, {
        headers: { 'X-Api-Key': bettygoKey },
      });

      if (!bettygoRes.ok) {
        const text = await bettygoRes.text().catch(() => '');
        res.status(502).json({ error: 'Failed to check Discord status', details: text });
        return;
      }

      const data = await bettygoRes.json();
      const verified = data?.verified ?? false;

      if (verified) {
        const { data: currentUser } = await supabase
          .from('users')
          .select('status')
          .eq('uid', uid)
          .maybeSingle();
        if (currentUser && currentUser.status !== 'Approved') {
          const updateFields: any = { status: 'Approved', updated_at: new Date().toISOString() };
          await supabase.from('users').update(updateFields).eq('uid', uid);
          try {
            await ensureUserHasMemberId(supabase, uid);
          } catch {
            // Member ID generation failed — ignore
          }
        }
      }

      res.status(200).json({ connected: true, discord_id: discordId, discord_username: resolvedUsername, discord_display_name: discordDisplayName, discord_avatar: discordAvatar, ...data });
      return;
    }

    if (req.method === 'POST') {
      const action = req.query?.action || 'sync';

      if (action === 'login') {
        if (!bettygoKey) {
          res.status(500).json({ error: 'Discord integration not configured' });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: 'Invalid token' });
          return;
        }

        const params = new URLSearchParams({
          user_id: uid,
          redirect_uri: callbackUrl,
        });

        const bettygoRes = await fetch(`${bettygoBaseUrl}/auth/login?${params.toString()}`, {
          headers: { 'X-Api-Key': bettygoKey },
        });

        if (!bettygoRes.ok) {
          const text = await bettygoRes.text().catch(() => '');
          res.status(502).json({ error: 'Failed to initiate Discord OAuth', details: text });
          return;
        }

        const data = await bettygoRes.json();
        res.status(200).json({ url: data.url });
        return;
      }

      if (action === 'sync') {
        if (!bettygoKey) {
          res.status(500).json({ error: 'Discord integration not configured' });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: 'Invalid token' });
          return;
        }

        const body = req.body ?? {};
        const discordIdFromBody: string | undefined = typeof body.discord_id === 'string' ? body.discord_id : undefined;
        const discordUsernameFromBody: string | undefined = typeof body.discord_username === 'string' ? body.discord_username.trim() : undefined;
        const discordDisplayNameFromBody: string | undefined = typeof body.discord_display_name === 'string' ? body.discord_display_name.trim() || undefined : undefined;
        const discordAvatarFromBody: string | undefined = typeof body.discord_avatar === 'string' ? body.discord_avatar.trim() || undefined : undefined;

        const { data: userData } = await supabase
          .from('users')
          .select('discord_id')
          .eq('uid', uid)
          .maybeSingle();

        const discordId = discordIdFromBody ?? userData?.discord_id;
        if (!discordId) {
          res.status(200).json({ connected: false });
          return;
        }

        const bettygoRes = await fetch(`${bettygoBaseUrl}/users/${discordId}/discord`, {
          headers: { 'X-Api-Key': bettygoKey },
        });

        if (!bettygoRes.ok) {
          res.status(200).json({ connected: false });
          return;
        }

        const { verified } = await bettygoRes.json();

        let discordUsername = discordUsernameFromBody ?? null;
        let discordDisplayName = discordDisplayNameFromBody ?? null;
        let discordAvatar = discordAvatarFromBody ?? null;
        if (!discordUsername) {
          const profile = await resolveDiscordProfile(discordId, discordBotToken);
          if (profile) {
            discordUsername = profile.username;
            discordDisplayName = profile.displayName;
            discordAvatar = profile.avatar;
          }
        }

        const updateFields: any = {
          discord_id: discordId,
          discord_username: discordUsername,
          discord_display_name: discordDisplayName,
          discord_avatar: discordAvatar,
          discord_connected: true,
          discord_verified: verified ?? false,
          updated_at: new Date().toISOString(),
        };

        if (verified) {
          updateFields.status = 'Approved';
        }

        await supabase.from('users').update(updateFields).eq('uid', uid);

        let memberId: string | null = null;
        if (verified) {
          try {
            memberId = await ensureUserHasMemberId(supabase, uid);
          } catch {
            // Member ID generation failed — still return success for Discord sync
          }
        }

        res.status(200).json({ connected: true, discord_id: discordId, discord_username: discordUsername, discord_display_name: discordDisplayName, discord_avatar: discordAvatar, verified, memberId });
        return;
      }

      res.status(400).json({ error: 'Unknown action' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Discord API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}