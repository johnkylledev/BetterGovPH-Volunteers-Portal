import { createClient } from '@supabase/supabase-js';
import {
  getSupabaseConfig,
  getBearerToken,
  getStringParam,
  getBody,
  createServiceClient,
  respondError,
  respond,
} from './_lib/supabase';

const mapCallRow = (row: any, postedBy?: { fullName: string; email: string }) => ({
  id: row.id,
  userId: row.user_id,
  title: row.title ?? '',
  projectUrl: row.project_url ?? '',
  description: row.description ?? '',
  rolesNeeded: row.roles_needed ?? undefined,
  contact: row.contact ?? undefined,
  status: row.status ?? 'open',
  createdAt: row.created_at,
  postedBy,
});

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
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

  const { data: callerRow } = await supabase.from('users').select('is_admin').eq('uid', uid).maybeSingle();
  const isAdmin = !!callerRow?.is_admin;

  if (req.method === 'GET') {
    const mine = getStringParam(req.query?.mine);
    const adminMode = getStringParam(req.query?.admin);
    const wantsAdmin = adminMode === '1' || adminMode === 'true';
    const statusFilter = getStringParam(req.query?.status);

    if (wantsAdmin && !isAdmin) {
      respondError(res, 403, 'Admin only');
      return;
    }

    let query = supabase.from('volunteer_calls').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (mine === '1' || mine === 'true') query = query.eq('user_id', uid);
    if (!wantsAdmin && mine !== '1' && mine !== 'true') query = query.eq('status', 'open');
    if (wantsAdmin && statusFilter && statusFilter !== 'All') query = query.eq('status', statusFilter);

    const { data, error, count } = await query.limit(50);
    if (error) {
      respondError(res, 500, 'Failed to load volunteer calls');
      return;
    }

    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    const userMap = new Map<string, { fullName: string; email: string }>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase.from('users').select('uid, full_name, email').in('uid', userIds);
      if (usersData) {
        for (const u of usersData) {
          userMap.set(u.uid, { fullName: u.full_name ?? '', email: u.email ?? '' });
        }
      }
    }

    respond(res, 200, {
      calls: rows.map((r: any) => mapCallRow(r, userMap.get(r.user_id))),
      totalCount: count ?? 0,
    });
    return;
  }

  if (req.method === 'DELETE') {
    const body = getBody(req);
    const id = typeof body.id === 'string' ? body.id : getStringParam(req.query?.id) || '';
    const deleteUser = typeof body.deleteUser === 'boolean' ? body.deleteUser : false;
    if (!id) {
      respondError(res, 400, 'id is required');
      return;
    }

    if (!isAdmin) {
      respondError(res, 403, 'Admin only');
      return;
    }

    const { data: call, error: callError } = await supabase
      .from('volunteer_calls')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (callError) {
      respondError(res, 500, 'Failed to load volunteer call');
      return;
    }
    if (!call) {
      respondError(res, 404, 'Volunteer call not found');
      return;
    }

    const { error: deleteError } = await supabase.from('volunteer_calls').delete().eq('id', id);
    if (deleteError) {
      respondError(res, 500, 'Failed to delete volunteer call');
      return;
    }

    if (deleteUser) {
      const userId = typeof (call as any).user_id === 'string' ? String((call as any).user_id) : '';
      if (userId) {
        await supabase.from('project_submissions').delete().eq('user_id', userId);
        await supabase.from('volunteer_calls').delete().eq('user_id', userId);
        await supabase.from('users').delete().eq('uid', userId);
        try {
          await supabase.auth.admin.deleteUser(userId);
        } catch {
          // Auth user may not exist
        }
      }
    }

    respond(res, 200, { message: deleteUser ? 'Deleted volunteer call and user' : 'Deleted volunteer call' });
    return;
  }

  const body = getBody(req);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const projectUrl = typeof body.project_url === 'string' ? body.project_url.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const rolesNeeded = typeof body.roles_needed === 'string' ? body.roles_needed.trim() : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';

  if (!title || !projectUrl || !description) {
    respondError(res, 400, 'title, project_url, and description are required');
    return;
  }

  const { data, error } = await supabase
    .from('volunteer_calls')
    .insert([
      {
        user_id: uid,
        title,
        project_url: projectUrl,
        description,
        roles_needed: rolesNeeded || null,
        contact: contact || null,
        status: 'open',
      },
    ])
    .select('id')
    .maybeSingle();

  if (error || !data?.id) {
    respondError(res, 500, 'Failed to create volunteer call');
    return;
  }

  respond(res, 200, { message: 'Posted successfully!', id: data.id });
}
