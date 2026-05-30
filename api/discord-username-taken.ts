import { createClient } from '@supabase/supabase-js';
import {
  getSupabaseConfig,
  getStringParam,
  respondError,
  respond,
} from './lib/supabase';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    respondError(res, 405, 'Method not allowed');
    return;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    respondError(res, 500, 'Server not configured');
    return;
  }

  const usernameRaw = getStringParam(req.query?.username);
  const username = (usernameRaw ?? '').trim();
  if (!username || username.length < 2 || username.length > 64) {
    respondError(res, 400, 'Invalid username');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('users')
    .select('uid')
    .eq('discord_username', username)
    .maybeSingle();

  if (error) {
    respondError(res, 500, 'Lookup failed');
    return;
  }

  respond(res, 200, { taken: !!data });
}
