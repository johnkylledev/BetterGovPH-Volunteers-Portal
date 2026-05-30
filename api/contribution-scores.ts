import { createClient } from '@supabase/supabase-js';
import { getContributionScores } from './lib/contributionScoring';

const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
  return { url, serviceKey };
};

const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const createServiceClient = (url: string, serviceKey: string) =>
  createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const respond = (res: any, statusCode: number, data: Record<string, unknown>) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
};

const respondError = (res: any, statusCode: number, message: string) => {
  respond(res, statusCode, { error: message });
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    respondError(res, 405, 'Method not allowed');
    return;
  }

  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) {
    respondError(res, 500, 'Server not configured');
    return;
  }

  const bearerToken = getBearerToken(req.headers?.authorization);
  if (!bearerToken) {
    respondError(res, 401, 'Missing Authorization bearer token');
    return;
  }

  const supabase = createServiceClient(supabaseUrl, serviceKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(bearerToken);
  if (authError || !authData?.user?.id) {
    respondError(res, 401, 'Invalid token');
    return;
  }

  const githubToken = process.env.GITHUB_TOKEN ?? '';
  if (!githubToken) {
    respondError(res, 500, 'Server not configured');
    return;
  }

  try {
    const scores = await getContributionScores(githubToken);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    respond(res, 200, { scores, generatedAt: new Date().toISOString() });
  } catch {
    respondError(res, 500, 'Failed to compute scores');
  }
}
