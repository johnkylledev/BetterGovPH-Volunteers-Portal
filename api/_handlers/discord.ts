/**
 * api/_handlers/discord.ts
 * GET/POST /discord — Discord OAuth and BettyGo integration
 */

import { createServiceClient } from '../_lib/http';
import { getSupabaseConfig } from '../_lib/config';
import { getBearerToken, sendJson, sendError } from '../_lib/http';
import { ensureUserHasMemberId } from '../_lib/admin';
import type { H } from '../_lib/types';

const resolveDiscordProfile = async (discordId: string, botToken: string) => {
  if (!botToken || !discordId) return null;
  try {
    const r = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { username?: string; global_name?: string | null; avatar?: string | null };
    return { username: d?.username ?? null, displayName: d?.global_name ?? null, avatar: d?.avatar ?? null };
  } catch {
    return null;
  }
};

export const handler_discord: H = async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const cfg = getSupabaseConfig();
    const supabaseUrl = cfg.url;
    const serviceRoleKey = cfg.serviceKey;
    const bettygoKey = process.env.BETTYGO_API_KEY || '';
    const bettygoBaseUrl = (process.env.BETTYGO_BASE_URL || '').replace(/\/$/, '');
    const callbackUrl = process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/discord-callback';
    const discordBotToken = process.env.DISCORD_BOT_TOKEN || '';
    if (!supabaseUrl || !serviceRoleKey) {
      sendError(res, 500, 'Server not configured');
      return;
    }
    if (!bettygoBaseUrl) {
      sendError(res, 500, 'BETTYGO_BASE_URL is not configured');
      return;
    }
    const supabase = createServiceClient(supabaseUrl, serviceRoleKey);
    const token = getBearerToken(req.headers?.authorization);
    if (!token && req.method !== 'GET') {
      sendError(res, 401, 'Missing Authorization bearer token');
      return;
    }
    let uid: string | null = null;
    if (token) {
      try {
        const { data: authData } = await supabase.auth.getUser(token);
        uid = authData?.user?.id ? String(authData.user.id) : null;
      } catch {
        uid = null;
      }
    }

    if (req.method === 'GET') {
      if (!bettygoKey) {
        sendJson(res, 200, { connected: false });
        return;
      }
      if (!uid) {
        sendError(res, 401, 'Missing Authorization bearer token');
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
        sendJson(res, 200, { connected: false });
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
        sendJson(res, 502, {
          connected: true,
          discord_id: discordId,
          error: 'Failed to check Discord status',
        });
        return;
      }
      const d = await bettygoRes.json();
      const verified = d?.verified ?? false;
      if (verified) {
        const { data: currentUser } = await supabase.from('users').select('status').eq('uid', uid).maybeSingle();
        if (currentUser && currentUser.status !== 'Approved') {
          await supabase.from('users').update({ status: 'Approved', updated_at: new Date().toISOString() }).eq('uid', uid);
          try {
            await ensureUserHasMemberId(supabase, uid);
          } catch {
            /* noop */
          }
        }
      }
      sendJson(res, 200, {
        connected: true,
        discord_id: discordId,
        discord_username: resolvedUsername,
        discord_display_name: discordDisplayName,
        discord_avatar: discordAvatar,
        ...d,
      });
      return;
    }

    if (req.method === 'POST') {
      const action = req.query?.action || 'sync';
      if (action === 'login') {
        if (!bettygoKey) {
          sendError(res, 500, 'Discord integration not configured');
          return;
        }
        if (!uid) {
          sendError(res, 401, 'Invalid token');
          return;
        }
        const params = new URLSearchParams({ user_id: uid, redirect_uri: callbackUrl });
        const bettygoRes = await fetch(`${bettygoBaseUrl}/auth/login?${params.toString()}`, {
          headers: { 'X-Api-Key': bettygoKey },
        });
        if (!bettygoRes.ok) {
          sendJson(res, 502, { error: 'Failed to initiate Discord OAuth' });
          return;
        }
        const d = await bettygoRes.json();
        sendJson(res, 200, { url: d.url });
        return;
      }
      if (action === 'sync') {
        if (!bettygoKey) {
          sendError(res, 500, 'Discord integration not configured');
          return;
        }
        if (!uid) {
          sendError(res, 401, 'Invalid token');
          return;
        }
        const body = req.body ?? {};
        const discordIdFromBody: string | undefined = typeof body.discord_id === 'string' ? body.discord_id : undefined;
        const discordUsernameFromBody: string | undefined =
          typeof body.discord_username === 'string' ? body.discord_username.trim() : undefined;
        const discordDisplayNameFromBody: string | undefined =
          typeof body.discord_display_name === 'string' ? (body.discord_display_name.trim() || undefined) : undefined;
        const discordAvatarFromBody: string | undefined =
          typeof body.discord_avatar === 'string' ? (body.discord_avatar.trim() || undefined) : undefined;
        const { data: userData } = await supabase
          .from('users')
          .select('discord_id')
          .eq('uid', uid)
          .maybeSingle();
        const discordId = discordIdFromBody ?? userData?.discord_id;
        if (!discordId) {
          sendJson(res, 200, { connected: false });
          return;
        }
        const bettygoRes = await fetch(`${bettygoBaseUrl}/users/${discordId}/discord`, {
          headers: { 'X-Api-Key': bettygoKey },
        });
        if (!bettygoRes.ok) {
          sendJson(res, 200, { connected: false });
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
          discord_verified: !!verified,
          updated_at: new Date().toISOString(),
        };
        if (verified) updateFields.status = 'Approved';
        await supabase.from('users').update(updateFields).eq('uid', uid);
        let memberId: string | null = null;
        if (verified) {
          try {
            memberId = await ensureUserHasMemberId(supabase, uid);
          } catch {
            /* noop */
          }
        }
        sendJson(res, 200, {
          connected: true,
          discord_id: discordId,
          discord_username: discordUsername,
          discord_display_name: discordDisplayName,
          discord_avatar: discordAvatar,
          verified,
          memberId,
        });
        return;
      }
      sendError(res, 400, 'Unknown action');
      return;
    }
    sendError(res, 405, 'Method not allowed');
  } catch (err: any) {
    console.error('Discord API error:', err);
    sendError(res, 500, 'Internal server error');
  }
};
