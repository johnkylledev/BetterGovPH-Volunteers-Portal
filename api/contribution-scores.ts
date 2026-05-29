import { getContributionScores } from './_lib/contributionScoring';
import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
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

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Server not configured', missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] });
    return;
  }

  const bearerToken = getBearerToken(req.headers?.authorization);
  if (!bearerToken) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(bearerToken);
  if (authError || !authData?.user?.id) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  const githubToken = process.env.GITHUB_TOKEN ?? '';
  if (!githubToken) {
    res.status(500).json({ error: 'Server not configured', missing: ['GITHUB_TOKEN'] });
    return;
  }

  try {
    const scores = await getContributionScores(githubToken);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json({ scores, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute scores' });
  }
}
