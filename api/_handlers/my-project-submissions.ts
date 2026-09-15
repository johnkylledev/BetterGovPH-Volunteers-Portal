/**
 * api/_handlers/my-project-submissions.ts
 * GET /my-project-submissions — User's own project submissions
 */

import { createServiceClient } from '../_lib/http';
import { getSupabaseConfig } from '../_lib/config';
import { getBearerToken, sendJson, sendError, getNumberParam } from '../_lib/http';
import type { H } from '../_lib/types';

const mapMySubmissionRow = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  projectName: row.project_name ?? '',
  projectUrl: row.project_url ?? '',
  description: row.description ?? '',
  projType: row.proj_type ?? row.tech_stack ?? undefined,
  status: row.status ?? 'pending',
  createdAt: row.created_at,
});

export const handler_my_project_submissions: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed');
    return;
  }
  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    sendError(res, 500, 'Server not configured');
    return;
  }
  const token = getBearerToken(req.headers?.authorization);
  if (!token) {
    sendError(res, 401, 'Missing Authorization bearer token');
    return;
  }
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  if (authError || !uid) {
    sendError(res, 401, 'Invalid token');
    return;
  }
  const page = Math.max(0, getNumberParam(req.query?.page, 0));
  const pageSize = Math.min(100, Math.max(1, getNumberParam(req.query?.pageSize, 20)));
  const result = await supabase
    .from('project_submissions')
    .select('*', { count: 'exact' })
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (result.error) {
    sendError(res, 500, 'Failed to load submissions');
    return;
  }
  sendJson(res, 200, {
    submissions: (result.data ?? []).map(mapMySubmissionRow),
    totalCount: result.count ?? 0,
  });
};
