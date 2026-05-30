import { createClient } from '@supabase/supabase-js';
import {
  getSupabaseConfig,
  getBearerToken,
  getStringParam,
  getNumberParam,
  createServiceClient,
  respondError,
  respond,
} from './_lib/supabase';

const mapSubmissionRow = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  projectName: row.project_name ?? '',
  projectUrl: row.project_url ?? '',
  description: row.description ?? '',
  projType: row.proj_type ?? row.tech_stack ?? undefined,
  status: row.status ?? 'pending',
  createdAt: row.created_at,
});

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    respondError(res, 405, 'Method not allowed');
    return;
  }

  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    respondError(res, 500, 'Server not configured');
    return;
  }

  const token = getBearerToken(req.headers?.authorization);
  if (!token) {
    respondError(res, 401, 'Missing Authorization bearer token');
    return;
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  if (authError || !uid) {
    respondError(res, 401, 'Invalid token');
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
    respondError(res, 500, 'Failed to load submissions');
    return;
  }

  respond(res, 200, {
    submissions: (result.data ?? []).map(mapSubmissionRow),
    totalCount: result.count ?? 0,
  });
}
