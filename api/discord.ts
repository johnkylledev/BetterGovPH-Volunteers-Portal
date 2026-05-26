import { createClient } from '@supabase/supabase-js';

const getConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  serviceKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE ||
    '',
  bettygoKey: process.env.BETTYGO_API_KEY || '',
  bettygoBaseUrl: (process.env.BETTYGO_BASE_URL || 'https://bg.zel.kim').replace(/\/$/, ''),
  callbackUrl: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/discord-callback',
});

const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const authenticateUser = async (supabase: any, token: string) => {
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  if (authError || !uid) {
    return null;
  }
  return uid;
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const { url: supabaseUrl, serviceKey, bettygoKey, bettygoBaseUrl, callbackUrl } = getConfig();

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

    const bettygoRes = await fetch(`${bettygoBaseUrl}/users/${uid}/discord`, {
      headers: { 'X-Api-Key': bettygoKey },
    });

    if (!bettygoRes.ok) {
      const text = await bettygoRes.text().catch(() => '');
      res.status(502).json({ error: 'Failed to check Discord status', details: text });
      return;
    }

    const data = await bettygoRes.json();
    res.status(200).json(data);
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

      const bettygoRes = await fetch(`${bettygoBaseUrl}/users/${uid}/discord`, {
        headers: { 'X-Api-Key': bettygoKey },
      });

      if (!bettygoRes.ok) {
        res.status(200).json({ connected: false });
        return;
      }

      const discordData = await bettygoRes.json();

      if (discordData.connected) {
        await supabase.from('users').update({
          discord_id: discordData.discord_id ?? null,
          discord_connected: true,
          discord_verified: discordData.verified ?? false,
          updated_at: new Date().toISOString(),
        }).eq('uid', uid);
      }

      res.status(200).json(discordData);
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}