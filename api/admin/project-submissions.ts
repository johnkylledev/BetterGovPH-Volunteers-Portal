import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE ||
    '';
  return { url, anonKey, serviceKey };
};

const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const getStringParam = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return null;
};

const getNumberParam = (value: unknown, fallback: number) => {
  const s = getStringParam(value);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

const getBody = (req: any) => {
  const body = req.body ?? {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
};

const assertAdmin = async (supabaseAdmin: any, token: string) => {
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    const message = typeof (authError as any)?.message === 'string' ? String((authError as any).message) : '';
    return { ok: false as const, error: message || 'Invalid token' };
  }

  const uid = authData.user.id;
  const { data: callerRow, error: callerError } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('uid', uid)
    .maybeSingle();

  if (callerError) return { ok: false as const, error: 'Failed to validate admin' };
  if (!callerRow?.is_admin) return { ok: false as const, error: 'Admin only' };
  return { ok: true as const };
};

const mapSubmissionRow = (row: any, submittedBy?: { fullName: string; email: string }) => ({
  id: row.id,
  userId: row.user_id,
  projectName: row.project_name ?? '',
  projectUrl: row.project_url ?? '',
  description: row.description ?? '',
  projType: row.proj_type ?? row.tech_stack ?? undefined,
  status: row.status ?? 'pending',
  createdAt: row.created_at,
  submittedBy,
});

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceKey: serviceRoleKey } = getSupabaseConfig();
  const primaryKey = serviceRoleKey || supabaseAnonKey;
  const fallbackKey = supabaseAnonKey && serviceRoleKey && supabaseAnonKey !== serviceRoleKey ? supabaseAnonKey : '';

  if (!supabaseUrl || !primaryKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!primaryKey) missing.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
    res.status(500).json({ error: 'Server not configured', missing });
    return;
  }

  const token = getBearerToken(req.headers?.authorization);
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return;
  }

  const makeClient = (key: string, bearerToken?: string) =>
    createClient(supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: bearerToken ? { headers: { Authorization: `Bearer ${bearerToken}` } } : undefined,
    });

  let supabaseAdmin = makeClient(primaryKey, primaryKey === supabaseAnonKey ? token : undefined);
  let adminCheck = await assertAdmin(supabaseAdmin, token);
  if (
    !adminCheck.ok &&
    fallbackKey &&
    typeof (adminCheck as any)?.error === 'string' &&
    String((adminCheck as any).error).toLowerCase().includes('invalid api key')
  ) {
    supabaseAdmin = makeClient(fallbackKey, token);
    adminCheck = await assertAdmin(supabaseAdmin, token);
  }
  if (!adminCheck.ok) {
    res.status(adminCheck.error === 'Admin only' ? 403 : 401).json({ error: adminCheck.error });
    return;
  }

  if (req.method === 'GET') {
    const page = Math.max(0, getNumberParam(req.query?.page, 0));
    const pageSize = Math.min(100, Math.max(1, getNumberParam(req.query?.pageSize, 20)));
    const statusFilter = getStringParam(req.query?.status);

    let query = supabaseAdmin.from('project_submissions').select('*', { count: 'exact' });
    if (statusFilter && statusFilter !== 'All') query = query.eq('status', statusFilter);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (error) {
      res.status(500).json({ error: 'Failed to load project submissions' });
      return;
    }

    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));

    const userMap = new Map<string, { fullName: string; email: string }>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from('users')
        .select('uid, full_name, email')
        .in('uid', userIds);
      for (const u of usersData ?? []) {
        userMap.set(u.uid, { fullName: u.full_name ?? '', email: u.email ?? '' });
      }
    }

    res.status(200).json({
      submissions: rows.map((r: any) => mapSubmissionRow(r, userMap.get(r.user_id))),
      totalCount: count ?? 0,
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = getBody(req);
  const id = typeof body.id === 'string' ? body.id : '';
  const action = typeof body.action === 'string' ? body.action : '';
  const deleteUser = typeof body.deleteUser === 'boolean' ? body.deleteUser : false;

  if (!id || (action !== 'approve' && action !== 'reject' && action !== 'delete')) {
    res.status(400).json({ error: 'id and action (approve|reject|delete) are required' });
    return;
  }

  const { data: submission, error: submissionError } = await supabaseAdmin
    .from('project_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (submissionError) {
    res.status(500).json({ error: 'Failed to load submission' });
    return;
  }

  if (!submission) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }

  const deleteUserCascade = async (userId: string) => {
    await supabaseAdmin.from('project_submissions').delete().eq('user_id', userId);
    await supabaseAdmin.from('volunteer_calls').delete().eq('user_id', userId);
    await supabaseAdmin.from('users').delete().eq('uid', userId);

    if (!serviceRoleKey) return;
    const serviceClient = makeClient(serviceRoleKey);
    try {
      await (serviceClient as any).auth.admin.deleteUser(userId);
    } catch {
      return;
    }
  };

  if (action === 'delete') {
    const { error: deleteError } = await supabaseAdmin.from('project_submissions').delete().eq('id', id);
    if (deleteError) {
      res.status(500).json({ error: 'Failed to delete submission' });
      return;
    }

    if (deleteUser) {
      const userId = typeof submission.user_id === 'string' ? submission.user_id : '';
      if (userId) await deleteUserCascade(userId);
    }

    res.status(200).json({ message: deleteUser ? 'Deleted submission and user' : 'Deleted submission' });
    return;
  }

  if (action === 'reject') {
    const { error: updateError } = await supabaseAdmin
      .from('project_submissions')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (updateError) {
      res.status(500).json({ error: 'Failed to reject submission' });
      return;
    }

    res.status(200).json({ message: 'Rejected' });
    return;
  }

  const { error: approveError } = await supabaseAdmin
    .from('project_submissions')
    .update({ status: 'approved' })
    .eq('id', id);

  if (approveError) {
    res.status(500).json({ error: 'Failed to approve submission' });
    return;
  }

  res.status(200).json({ message: 'Approved' });
}
