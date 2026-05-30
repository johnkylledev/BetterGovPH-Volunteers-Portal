import { getContributionScores } from './_lib/contributionScoring';
import {
  getSupabaseConfig,
  getBearerToken,
  createServiceClient,
  respondError,
  respond,
} from './_lib/supabase';

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
