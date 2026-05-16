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

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url: supabaseUrl, serviceKey, bettygoKey, bettygoBaseUrl, callbackUrl } = getConfig();

  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  if (!bettygoKey) {
    res.status(500).json({ error: 'Discord integration not configured' });
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
}
