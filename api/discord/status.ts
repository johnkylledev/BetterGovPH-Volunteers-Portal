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
});

const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url: supabaseUrl, serviceKey, bettygoKey, bettygoBaseUrl } = getConfig();

  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  if (!bettygoKey) {
    res.status(200).json({ connected: false });
    return;
  }

  const token = getBearerToken(req.headers?.authorization);
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  if (authError || !uid) {
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

  const data = await bettygoRes.json();
  res.status(200).json(data);
}
