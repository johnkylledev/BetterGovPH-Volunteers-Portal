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

const assertAdmin = async (supabaseAdmin: any, uid: string, email?: string) => {
  let { data: callerRow, error: callerError } = await supabaseAdmin
    .from('users')
    .select('uid, is_admin, email')
    .eq('uid', uid)
    .maybeSingle();
    
  if (!callerRow && email) {
    ({ data: callerRow, error: callerError } = await supabaseAdmin
      .from('users')
      .select('uid, is_admin, email')
      .eq('email', email)
      .maybeSingle());
  }
  
  if (callerError) return { ok: false as const, error: 'Failed to validate admin' };
  if (!callerRow?.is_admin) return { ok: false as const, error: 'Admin only' };
  return { ok: true as const };
};

const mapUserRow = (row: any) => ({
  id: row.uid,
  uid: row.uid,
  fullName: row.full_name ?? '',
  email: row.email ?? '',
  specialization: row.specialization ?? '',
  role: row.role ?? 'Member',
  discordUsername: row.discord_username ?? '',
  status: row.status ?? 'Pending',
  memberId: row.member_id ?? undefined,
  yearJoined: row.year_joined ?? undefined,
  skills: row.skills ?? [],
  experienceLevel: row.experience_level ?? undefined,
  adminNotes: row.admin_notes ?? undefined,
  isAdmin: !!row.is_admin,
  authProvider: row.auth_provider ?? 'traditional',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

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

const generateUniqueMemberId = async (supabaseAdmin: any, selectedYear: number) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('member_id')
      .ilike('member_id', `BGPH-${selectedYear}-%`)
      .order('member_id', { ascending: false })
      .limit(100);

    if (error) throw error;

    let maxSequence = 0;
    for (const u of data ?? []) {
      const memberId = u.member_id;
      if (typeof memberId !== 'string') continue;
      const match = memberId.match(/^BGPH-(\d{4})-(\d{3})$/);
      if (match && parseInt(match[1]) === selectedYear) {
        const seq = parseInt(match[2], 10);
        if (!isNaN(seq) && seq > maxSequence) maxSequence = seq;
      }
    }

    const nextSequence = maxSequence + 1;
    const newMemberId = `BGPH-${selectedYear}-${String(nextSequence).padStart(3, '0')}`;
    
    const { data: checkDuplicate } = await supabaseAdmin
      .from('users')
      .select('member_id')
      .eq('member_id', newMemberId)
      .maybeSingle();
    
    if (!checkDuplicate) {
      return newMemberId;
    }
  }
  
  throw new Error('Failed to generate unique member ID after 5 attempts');
};

const ensureUserHasMemberId = async (supabaseAdmin: any, uid: string) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('member_id, year_joined')
    .eq('uid', uid)
    .maybeSingle();

  if (error) throw error;
  if (data?.member_id) return data.member_id as string;

  const yearJoined = data?.year_joined || new Date().getFullYear();
  const memberId = await generateUniqueMemberId(supabaseAdmin, yearJoined);
  await supabaseAdmin
    .from('users')
    .update({ member_id: memberId, updated_at: new Date().toISOString() })
    .eq('uid', uid);

  return memberId;
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

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const resource = getStringParam(req.query?.resource);

  if (req.method === 'GET' && resource === 'stats') {
    const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceKey: serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      res.status(500).json({ error: 'Server not configured' });
      return;
    }

    const token = getBearerToken(req.headers?.authorization);
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization bearer token' });
      return;
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    const uid = authData?.user?.id ? String(authData.user.id) : '';
    const email = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !uid) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const adminCheck = await assertAdmin(supabaseAdmin, uid, email);
    if (!adminCheck.ok) {
      res.status(403).json({ error: adminCheck.error });
      return;
    }

    const { count: total, error: totalError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      res.status(500).json({ error: 'Failed to load stats' });
      return;
    }

    const { count: pending, error: pendingError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Pending')
      .not('full_name', 'eq', '');

    if (pendingError) {
      res.status(500).json({ error: 'Failed to load stats' });
      return;
    }

    const { count: approved, error: approvedError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Approved');

    if (approvedError) {
      res.status(500).json({ error: 'Failed to load stats' });
      return;
    }

    res.status(200).json({
      total: total ?? 0,
      pending: pending ?? 0,
      approved: approved ?? 0,
    });
    return;
  }

  if (req.method === 'GET' && resource === 'users') {
    const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) {
      res.status(500).json({ error: 'Server not configured' });
      return;
    }

    const token = getBearerToken(req.headers?.authorization);
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization bearer token' });
      return;
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const uid = authData?.user?.id ? String(authData.user.id) : '';
    const email = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !uid) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const adminCheck = await assertAdmin(supabaseAdmin, uid, email);
    if (!adminCheck.ok) {
      res.status(403).json({ error: adminCheck.error });
      return;
    }

    const page = Math.max(0, getNumberParam(req.query?.page, 0));
    const pageSize = Math.min(100, Math.max(1, getNumberParam(req.query?.pageSize, 20)));
    const statusFilter = getStringParam(req.query?.status);
    const roleFilter = getStringParam(req.query?.role);
    const searchRaw = getStringParam(req.query?.search);

    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })
      .eq('is_admin', false)
      .not('full_name', 'eq', '');

    if (statusFilter && statusFilter !== 'All') {
      query = query.eq('status', statusFilter);
    }

    if (roleFilter && roleFilter !== 'All') {
      query = query.eq('specialization', roleFilter);
    }

    if (searchRaw && searchRaw.trim()) {
      const safe = searchRaw.trim().replace(/[,()]/g, ' ').slice(0, 64);
      const search = `%${safe}%`;
      query = query.or(
        `full_name.ilike.${search},email.ilike.${search},discord_username.ilike.${search},member_id.ilike.${search}`
      );
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (error) {
      res.status(500).json({ error: 'Failed to load users' });
      return;
    }

    res.status(200).json({
      users: (data ?? []).map(mapUserRow),
      totalCount: count ?? 0,
    });
    return;
  }

  if (req.method === 'POST' && resource === 'user-status') {
    const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceKey: serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      res.status(500).json({ error: 'Server not configured' });
      return;
    }

    const token = getBearerToken(req.headers?.authorization);
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization bearer token' });
      return;
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    const callerEmail = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !callerUid) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminCheck = await assertAdmin(supabaseAdmin, callerUid, callerEmail);
    if (!adminCheck.ok) {
      res.status(adminCheck.error === 'Admin only' ? 403 : 401).json({ error: adminCheck.error });
      return;
    }

    const body = getBody(req);
    const uid = typeof body.uid === 'string' ? body.uid : typeof body.id === 'string' ? body.id : null;
    const status = typeof body.status === 'string' ? body.status : null;
    const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : undefined;
    const isAdmin = typeof body.isAdmin === 'boolean' ? body.isAdmin : undefined;

    if (!uid) {
      res.status(400).json({ error: 'Missing uid' });
      return;
    }

    if (!status && isAdmin === undefined) {
      res.status(400).json({ error: 'Must provide status or isAdmin' });
      return;
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (adminNotes !== undefined) updates.admin_notes = adminNotes;
    if (isAdmin !== undefined) updates.is_admin = isAdmin;

    let memberId: string | undefined;
    if (status === 'Approved' || isAdmin === true) {
      try {
        memberId = await ensureUserHasMemberId(supabaseAdmin, uid);
        updates.member_id = memberId;
      } catch (err) {
        res.status(500).json({ error: 'Failed to generate memberId' });
        return;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('uid', uid)
      .select('*');

    if (error) {
      res.status(500).json({ error: 'Failed to update user' });
      return;
    }

    if (!data || data.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ memberId: memberId ?? data[0]?.member_id ?? null });
    return;
  }

  if (req.method === 'GET' && resource === 'submissions') {
    const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) {
      res.status(500).json({ error: 'Server not configured' });
      return;
    }

    const token = getBearerToken(req.headers?.authorization);
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization bearer token' });
      return;
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    const callerEmail = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !callerUid) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const adminCheck = await assertAdmin(supabaseAdmin, callerUid, callerEmail);
    if (!adminCheck.ok) {
      res.status(403).json({ error: adminCheck.error });
      return;
    }

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

  if (req.method === 'POST' && resource === 'submissions') {
    const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) {
      res.status(500).json({ error: 'Server not configured' });
      return;
    }

    const token = getBearerToken(req.headers?.authorization);
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization bearer token' });
      return;
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    const callerEmail = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !callerUid) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const adminCheck = await assertAdmin(supabaseAdmin, callerUid, callerEmail);
    if (!adminCheck.ok) {
      res.status(403).json({ error: adminCheck.error });
      return;
    }

    const body = getBody(req);
    const id = typeof body.id === 'string' ? body.id : '';
    const action = typeof body.action === 'string' ? body.action : '';
    const deleteUser = typeof body.deleteUser === 'boolean' ? body.deleteUser : false;

    if (!id || (action !== 'approve' && action !== 'reject' && action !== 'delete' && action !== 'update')) {
      res.status(400).json({ error: 'id and action (approve|reject|delete|update) are required' });
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

    if (action === 'approve') {
      const { error: approveError } = await supabaseAdmin
        .from('project_submissions')
        .update({ status: 'approved' })
        .eq('id', id);

      if (approveError) {
        console.error('Approve submission error:', approveError);
        res.status(500).json({ error: 'Failed to approve submission', details: approveError.message });
        return;
      }

      res.status(200).json({ message: 'Approved submission' });
      return;
    }

    if (action === 'reject') {
      const { error: rejectError } = await supabaseAdmin
        .from('project_submissions')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (rejectError) {
        console.error('Reject submission error:', rejectError);
        res.status(500).json({ error: 'Failed to reject submission', details: rejectError.message });
        return;
      }

      res.status(200).json({ message: 'Rejected submission' });
      return;
    }

    if (action === 'update') {
      const updateFields: Record<string, any> = {};
      if (typeof body.project_name === 'string') updateFields.project_name = body.project_name.trim();
      if (typeof body.project_url === 'string') updateFields.project_url = body.project_url.trim();
      if (typeof body.description === 'string') updateFields.description = body.description.trim();
      if (typeof body.proj_type === 'string') updateFields.proj_type = body.proj_type.trim();
      if (typeof body.status === 'string' && ['pending', 'approved', 'rejected'].includes(body.status)) {
        updateFields.status = body.status;
      }

      if (Object.keys(updateFields).length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      const { error: updateError } = await supabaseAdmin
        .from('project_submissions')
        .update(updateFields)
        .eq('id', id);

      if (updateError) {
        res.status(500).json({ error: 'Failed to update submission' });
        return;
      }

      res.status(200).json({ message: 'Updated submission' });
      return;
    }

    if (action === 'delete') {
      const { error: deleteError } = await supabaseAdmin.from('project_submissions').delete().eq('id', id);
      if (deleteError) {
        res.status(500).json({ error: 'Failed to delete submission' });
        return;
      }

      if (deleteUser) {
        const userId = typeof submission.user_id === 'string' ? submission.user_id : '';
        if (userId) {
          await supabaseAdmin.from('project_submissions').delete().eq('user_id', userId);
          await supabaseAdmin.from('volunteer_calls').delete().eq('user_id', userId);
          await supabaseAdmin.from('users').delete().eq('uid', userId);
        }
      }

      res.status(200).json({ message: deleteUser ? 'Deleted submission and user' : 'Deleted submission' });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
    return;
  }

  res.status(400).json({ error: 'Unknown resource or method' });
}