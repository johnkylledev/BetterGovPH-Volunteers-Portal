/**
 * api/_handlers/contribution-scores.ts
 * GET /contribution-scores — Compute GitHub contribution scores
 */

import { createServiceClient } from '../_lib/http';
import { getSupabaseConfig } from '../_lib/config';
import { getBearerToken, sendJson, sendError } from '../_lib/http';
import { getContributionScores } from '../_lib/scoring';
import type { H } from '../_lib/types';

export const handler_contribution_scores: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed');
    return;
  }
  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) {
    sendError(res, 500, 'Server not configured');
    return;
  }
  const bearerToken = getBearerToken(req.headers?.authorization);
  if (!bearerToken) {
    sendError(res, 401, 'Missing Authorization bearer token');
    return;
  }
  const supabase = createServiceClient(supabaseUrl, serviceKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(bearerToken);
  if (authError || !authData?.user?.id) {
    sendError(res, 401, 'Invalid token');
    return;
  }
  const githubToken = process.env.GITHUB_TOKEN ?? '';
  if (!githubToken) {
    sendError(res, 500, 'Server not configured');
    return;
  }
  try {
    const scores = await getContributionScores(githubToken);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    sendJson(res, 200, { scores, generatedAt: new Date().toISOString() });
  } catch {
    sendError(res, 500, 'Failed to compute scores');
  }
};
