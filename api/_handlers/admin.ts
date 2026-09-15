/**
 * api/_handlers/admin.ts
 * GET/POST /admin — Admin dashboard and moderation
 */

import { createServiceClient, createAnonClient, getBody, sendJson, sendError, mapUserRow } from '../_lib/http';
import { getSupabaseConfig } from '../_lib/config';
import { getBearerToken, getStringParam, getNumberParam } from '../_lib/http';
import { assertAdmin, ensureUserHasMemberId } from '../_lib/admin';
import { getCache, setCache, invalidateCache } from '../_lib/redis';
import type { H } from '../_lib/types';

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

export const handler_admin: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const resource = getStringParam(req.query?.resource);
  const cfg = getSupabaseConfig();
  const serviceRoleKey = cfg.serviceKey;
  const supabaseUrl = cfg.url;
  const supabaseAnonKey = cfg.anonKey;

  if (req.method === 'GET' && resource === 'stats') {
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      sendError(res, 500, 'Server not configured');
      return;
    }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) {
      sendError(res, 401, 'Missing Authorization bearer token');
      return;
    }
    const supabaseAuth = createAnonClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    const uid = authData?.user?.id ? String(authData.user.id) : '';
    const email = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !uid) {
      sendError(res, 401, 'Invalid token');
      return;
    }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const adminCheck = await assertAdmin(adminSup, uid, email);
    if (!adminCheck.ok) {
      sendError(res, 403, adminCheck.error!);
      return;
    }
    const cacheKey = 'cache:admin:stats';
    try {
      const c = await getCache<any>(cacheKey);
      if (c) {
        sendJson(res, 200, c);
        return;
      }
    } catch {
      /* noop */
    }
    const { count: total } = await adminSup
      .from('users')
      .select('*', { count: 'exact', head: true })
      .or('discord_connected.eq.true,status.eq.Approved,status.eq.approved');
    const { count: pending } = await adminSup
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Pending', 'pending', 'PENDING'])
      .not('full_name', 'eq', '')
      .eq('discord_connected', true);
    const { count: approved } = await adminSup
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Approved', 'approved', 'APPROVED']);
    const payload = { total: total ?? 0, pending: pending ?? 0, approved: approved ?? 0 };
    try {
      await setCache(cacheKey, payload, 60);
    } catch {
      /* noop */
    }
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === 'GET' && resource === 'users') {
    if (!supabaseUrl || !serviceRoleKey) {
      sendError(res, 500, 'Server not configured');
      return;
    }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) {
      sendError(res, 401, 'Missing Authorization bearer token');
      return;
    }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminSup.auth.getUser(token);
    const uid = authData?.user?.id ? String(authData.user.id) : '';
    const email = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !uid) {
      sendError(res, 401, 'Invalid token');
      return;
    }
    const adminCheck = await assertAdmin(adminSup, uid, email);
    if (!adminCheck.ok) {
      sendError(res, 403, adminCheck.error!);
      return;
    }
    const page = Math.max(0, getNumberParam(req.query?.page, 0));
    const pageSize = Math.min(100, Math.max(1, getNumberParam(req.query?.pageSize, 20)));
    const statusFilter = getStringParam(req.query?.status);
    const roleFilter = getStringParam(req.query?.role);
    const searchRaw = getStringParam(req.query?.search);
    let query: any = adminSup
      .from('users')
      .select('*', { count: 'exact' })
      .eq('is_admin', false)
      .not('full_name', 'eq', '')
      .or('discord_connected.eq.true,status.eq.Approved,status.eq.approved');
    if (statusFilter && statusFilter !== 'All') {
      const variants = Array.from(
        new Set([
          statusFilter,
          statusFilter.toLowerCase(),
          statusFilter.toUpperCase(),
          statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1).toLowerCase(),
        ]),
      );
      query = query.in('status', variants);
    }
    if (roleFilter && roleFilter !== 'All') query = query.eq('specialization', roleFilter);
    if (searchRaw && searchRaw.trim()) {
      const safe = searchRaw.trim().replace(/[%_]/g, '').slice(0, 64);
      const search = `%${safe}%`;
      query = query.or(`full_name.ilike.${search},email.ilike.${search},discord_username.ilike.${search},member_id.ilike.${search}`);
    }
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) {
      sendError(res, 500, 'Failed to load users');
      return;
    }
    sendJson(res, 200, { users: (data ?? []).map(mapUserRow), totalCount: count ?? 0 });
    return;
  }

  if (req.method === 'POST' && resource === 'user-status') {
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      sendError(res, 500, 'Server not configured');
      return;
    }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) {
      sendError(res, 401, 'Missing Authorization bearer token');
      return;
    }
    const supabaseAuth = createAnonClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    const callerEmail = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !callerUid) {
      sendError(res, 401, 'Invalid token');
      return;
    }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const adminCheck = await assertAdmin(adminSup, callerUid, callerEmail);
    if (!adminCheck.ok) {
      sendError(res, adminCheck.error === 'Admin only' ? 403 : 401, adminCheck.error!);
      return;
    }
    const body = getBody(req);
    const idUid = typeof body.uid === 'string' ? body.uid : typeof body.id === 'string' ? body.id : null;
    const status = typeof body.status === 'string' ? body.status : null;
    const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : undefined;
    const isAdmin = typeof body.isAdmin === 'boolean' ? body.isAdmin : undefined;
    if (!idUid) {
      sendError(res, 400, 'Missing uid');
      return;
    }
    if (!status && isAdmin === undefined) {
      sendError(res, 400, 'Must provide status or isAdmin');
      return;
    }
    const updates: any = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (adminNotes !== undefined) updates.admin_notes = adminNotes;
    if (isAdmin !== undefined) {
      if (idUid === callerUid) {
        sendError(res, 403, 'Cannot modify your own admin status');
        return;
      }
      updates.is_admin = isAdmin;
    }
    let memberId: string | undefined;
    if (status === 'Approved' || isAdmin === true) {
      try {
        memberId = await ensureUserHasMemberId(adminSup, idUid);
        updates.member_id = memberId;
      } catch {
        sendError(res, 500, 'Failed to generate memberId');
        return;
      }
    }
    const { data, error } = await adminSup.from('users').update(updates).eq('uid', idUid).select('*');
    if (error) {
      sendError(res, 500, 'Failed to update user');
      return;
    }
    if (!data || data.length === 0) {
      sendError(res, 404, 'User not found');
      return;
    }
    try {
      await invalidateCache('cache:admin:stats');
      await invalidateCache('cache:verify:*');
    } catch {
      /* noop */
    }
    sendJson(res, 200, { memberId: memberId ?? data[0]?.member_id ?? null });
    return;
  }

  if (req.method === 'GET' && resource === 'submissions') {
    if (!supabaseUrl || !serviceRoleKey) {
      sendError(res, 500, 'Server not configured');
      return;
    }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) {
      sendError(res, 401, 'Missing Authorization bearer token');
      return;
    }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminSup.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    const callerEmail = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !callerUid) {
      sendError(res, 401, 'Invalid token');
      return;
    }
    const adminCheck = await assertAdmin(adminSup, callerUid, callerEmail);
    if (!adminCheck.ok) {
      sendError(res, 403, adminCheck.error!);
      return;
    }
    const page = Math.max(0, getNumberParam(req.query?.page, 0));
    const pageSize = Math.min(100, Math.max(1, getNumberParam(req.query?.pageSize, 20)));
    const statusFilter = getStringParam(req.query?.status);
    let query: any = adminSup.from('project_submissions').select('*', { count: 'exact' });
    if (statusFilter && statusFilter !== 'All') query = query.eq('status', statusFilter);
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) {
      sendError(res, 500, 'Failed to load project submissions');
      return;
    }
    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    const userMap = new Map<string, { fullName: string; email: string }>();
    if (userIds.length > 0) {
      const { data: usersData } = await adminSup.from('users').select('uid, full_name, email').in('uid', userIds);
      for (const u of usersData ?? [])
        userMap.set(u.uid, { fullName: u.full_name ?? '', email: u.email ?? '' });
    }
    sendJson(res, 200, {
      submissions: rows.map((r: any) => mapSubmissionRow(r, userMap.get(r.user_id))),
      totalCount: count ?? 0,
    });
    return;
  }

  if (req.method === 'POST' && resource === 'submissions') {
    if (!supabaseUrl || !serviceRoleKey) {
      sendError(res, 500, 'Server not configured');
      return;
    }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) {
      sendError(res, 401, 'Missing Authorization bearer token');
      return;
    }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminSup.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    const callerEmail = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !callerUid) {
      sendError(res, 401, 'Invalid token');
      return;
    }
    const adminCheck = await assertAdmin(adminSup, callerUid, callerEmail);
    if (!adminCheck.ok) {
      sendError(res, 403, adminCheck.error!);
      return;
    }
    const body = getBody(req);
    const id = typeof body.id === 'string' ? body.id : '';
    const action = typeof body.action === 'string' ? body.action : '';
    const deleteUser = typeof body.deleteUser === 'boolean' ? body.deleteUser : false;
    if (!id || (action !== 'approve' && action !== 'reject' && action !== 'delete' && action !== 'update')) {
      sendError(res, 400, 'id and action (approve|reject|delete|update) are required');
      return;
    }
    const { data: submission, error: submissionError } = await adminSup
      .from('project_submissions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (submissionError) {
      sendError(res, 500, 'Failed to load submission');
      return;
    }
    if (!submission) {
      sendError(res, 404, 'Submission not found');
      return;
    }
    const invalidateProjectCache = async () => {
      try {
        await invalidateCache('cache:projects:approved');
        await invalidateCache('cache:admin:stats');
      } catch {
        /* noop */
      }
    };
    if (action === 'approve') {
      const { error: approveError } = await adminSup
        .from('project_submissions')
        .update({ status: 'approved' })
        .eq('id', id);
      if (approveError) {
        sendError(res, 500, 'Failed to approve submission');
        return;
      }
      await invalidateProjectCache();
      sendJson(res, 200, { message: 'Approved submission' });
      return;
    }
    if (action === 'reject') {
      const { error: rejectError } = await adminSup
        .from('project_submissions')
        .update({ status: 'rejected' })
        .eq('id', id);
      if (rejectError) {
        sendError(res, 500, 'Failed to reject submission');
        return;
      }
      await invalidateProjectCache();
      sendJson(res, 200, { message: 'Rejected submission' });
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
        sendError(res, 400, 'No fields to update');
        return;
      }
      const { error: updateError } = await adminSup
        .from('project_submissions')
        .update(updateFields)
        .eq('id', id);
      if (updateError) {
        sendError(res, 500, 'Failed to update submission');
        return;
      }
      await invalidateProjectCache();
      sendJson(res, 200, { message: 'Updated submission' });
      return;
    }
    if (action === 'delete') {
      const { error: deleteError } = await adminSup.from('project_submissions').delete().eq('id', id);
      if (deleteError) {
        sendError(res, 500, 'Failed to delete submission');
        return;
      }
      if (deleteUser) {
        const userId = typeof submission.user_id === 'string' ? submission.user_id : '';
        if (userId) {
          await adminSup.from('project_submissions').delete().eq('user_id', userId);
          await adminSup.from('volunteer_calls').delete().eq('user_id', userId);
          await adminSup.from('users').delete().eq('uid', userId);
          try {
            await adminSup.auth.admin.deleteUser(userId);
          } catch {
            /* noop */
          }
        }
      }
      await invalidateProjectCache();
      sendJson(res, 200, { message: deleteUser ? 'Deleted submission and user' : 'Deleted submission' });
      return;
    }
    sendError(res, 400, 'Unknown action');
    return;
  }

  sendError(res, 400, 'Unknown resource or method');
};
