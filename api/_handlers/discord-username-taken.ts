/**
 * api/_handlers/discord-username-taken.ts
 * GET /discord-username-taken — Check if Discord username is taken
 */

import { createAnonClient } from '../_lib/http';
import { getSupabaseConfig } from '../_lib/config';
import { sendJson, sendError, getStringParam } from '../_lib/http';
import type { H } from '../_lib/types';

export const handler_discord_username_taken: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed');
    return;
  }
  const { url: supabaseUrl, anonKey } = getSupabaseConfig();
  if (!supabaseUrl || !anonKey) {
    sendError(res, 500, 'Server not configured');
    return;
  }
  const usernameRaw = getStringParam(req.query?.username);
  const username = (usernameRaw ?? '').trim();
  if (!username || username.length < 2 || username.length > 64) {
    sendError(res, 400, 'Invalid username');
    return;
  }
  const supabase = createAnonClient(supabaseUrl, anonKey);
  const { data, error } = await supabase
    .from('users')
    .select('uid')
    .eq('discord_username', username)
    .maybeSingle();
  if (error) {
    sendError(res, 500, 'Lookup failed');
    return;
  }
  sendJson(res, 200, { taken: !!data });
};
