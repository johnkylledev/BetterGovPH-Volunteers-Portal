/**
 * api/_handlers/volunteer-calls.ts
 * GET/POST/PUT/PATCH/DELETE /volunteer-calls — Volunteer call CRUD
 */

import { createServiceClient } from '../_lib/http';
import { getSupabaseConfig } from '../_lib/config';
import { getBearerToken, getBody, sendJson, sendError, getStringParam } from '../_lib/http';
import type { H } from '../_lib/types';

let _crypto: any = null;
let _cryptoInit = false;

const tryLoadCrypto = (): any => {
  if (_cryptoInit) return _crypto;
  _cryptoInit = true;
  try {
    const req = (globalThis as any).require;
    if (typeof req === 'function') {
      const mod = req('node:crypto');
      if (mod && typeof mod.randomUUID === 'function') _crypto = mod;
    }
  } catch {
    _crypto = null;
  }
  return _crypto;
};

const safeRandomUuid = (): string => {
  try {
    const mod = tryLoadCrypto();
    if (mod && typeof mod.randomUUID === 'function') {
      const v = mod.randomUUID();
      if (typeof v === 'string' && v.length > 0) return v;
    }
  } catch {
    /* noop */
  }
  const rnd = (n: number) => {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  };
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-a${rnd(3)}-${rnd(12)}`;
};

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

export const handler_volunteer_calls: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE' && req.method !== 'PATCH' && req.method !== 'PUT') {
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
  const { data: callerRow } = await supabase.from('users').select('is_admin').eq('uid', uid).maybeSingle();
  const isAdmin = !!callerRow?.is_admin;

  if (req.method === 'GET') {
    const mine = getStringParam(req.query?.mine);
    const adminMode = getStringParam(req.query?.admin);
    const wantsAdmin = adminMode === '1' || adminMode === 'true';
    const statusFilter = getStringParam(req.query?.status);
    if (wantsAdmin && !isAdmin) {
      sendError(res, 403, 'Admin only');
      return;
    }
    let query: any = supabase
      .from('volunteer_calls')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (mine === '1' || mine === 'true') query = query.eq('user_id', uid);
    if (!wantsAdmin && mine !== '1' && mine !== 'true') {
      if (uid) query = query.or(`status.eq.open,user_id.eq.${uid}`);
      else query = query.eq('status', 'open');
    }
    if (wantsAdmin && statusFilter && statusFilter !== 'All') query = query.eq('status', statusFilter);
    const { data, error, count } = await query.limit(50);
    if (error) {
      sendError(res, 500, 'Failed to load volunteer calls');
      return;
    }
    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    const userMap = new Map<string, { fullName: string; email: string }>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase.from('users').select('uid, full_name, email').in('uid', userIds);
      if (usersData)
        for (const u of usersData)
          userMap.set(u.uid, { fullName: u.full_name ?? '', email: u.email ?? '' });
    }
    sendJson(res, 200, {
      calls: rows.map((r: any) => mapCallRow(r, userMap.get(r.user_id))),
      totalCount: count ?? 0,
    });
    return;
  }

  const body = getBody(req);
  const isUpdate =
    req.method === 'PATCH' ||
    req.method === 'PUT' ||
    (req.method === 'POST' && (Boolean(body.id) || body.action === 'update' || body.action === 'edit'));
  if (isUpdate) {
    const id = typeof body.id === 'string' ? body.id : getStringParam(req.query?.id) || '';
    if (!id) {
      sendError(res, 400, 'id is required');
      return;
    }
    const { data: call, error: callError } = await supabase
      .from('volunteer_calls')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (callError) {
      sendError(res, 500, 'Failed to load volunteer call');
      return;
    }
    if (!call) {
      sendError(res, 404, 'Volunteer call not found');
      return;
    }
    if (!isAdmin && (call as any).user_id !== uid) {
      sendError(res, 403, 'Forbidden: You do not own this volunteer call');
      return;
    }
    const updateFields: Record<string, any> = {};
    if (typeof body.title === 'string') updateFields.title = body.title.trim();
    if (typeof body.project_url === 'string') updateFields.project_url = body.project_url.trim();
    if (typeof body.projectUrl === 'string') updateFields.project_url = body.projectUrl.trim();
    if (typeof body.description === 'string') updateFields.description = body.description.trim();
    if (typeof body.roles_needed === 'string') updateFields.roles_needed = body.roles_needed.trim() || null;
    if (typeof body.rolesNeeded === 'string') updateFields.roles_needed = body.rolesNeeded.trim() || null;
    if (typeof body.contact === 'string') updateFields.contact = body.contact.trim() || null;
    if (typeof body.status === 'string' && ['open', 'closed'].includes(body.status.toLowerCase())) {
      updateFields.status = body.status.toLowerCase();
    }
    if (Object.keys(updateFields).length === 0) {
      sendError(res, 400, 'No fields to update');
      return;
    }
    const { error: updateError } = await supabase.from('volunteer_calls').update(updateFields).eq('id', id);
    if (updateError) {
      sendError(res, 500, 'Failed to update volunteer call');
      return;
    }
    sendJson(res, 200, { message: 'Updated volunteer call successfully' });
    return;
  }

  if (req.method === 'DELETE') {
    const id = typeof body.id === 'string' ? body.id : getStringParam(req.query?.id) || '';
    const deleteUser = typeof body.deleteUser === 'boolean' ? body.deleteUser : false;
    if (!id) {
      sendError(res, 400, 'id is required');
      return;
    }
    const { data: call, error: callError } = await supabase
      .from('volunteer_calls')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (callError) {
      sendError(res, 500, 'Failed to load volunteer call');
      return;
    }
    if (!call) {
      sendError(res, 404, 'Volunteer call not found');
      return;
    }
    if (!isAdmin && (call as any).user_id !== uid) {
      sendError(res, 403, 'Forbidden: You do not own this volunteer call');
      return;
    }
    const { error: deleteError } = await supabase.from('volunteer_calls').delete().eq('id', id);
    if (deleteError) {
      sendError(res, 500, 'Failed to delete volunteer call');
      return;
    }
    if (deleteUser && isAdmin) {
      const userId = typeof (call as any).user_id === 'string' ? String((call as any).user_id) : '';
      if (userId) {
        await supabase.from('project_submissions').delete().eq('user_id', userId);
        await supabase.from('volunteer_calls').delete().eq('user_id', userId);
        await supabase.from('users').delete().eq('uid', userId);
        try {
          await supabase.auth.admin.deleteUser(userId);
        } catch {
          /* noop */
        }
      }
    }
    sendJson(res, 200, {
      message: deleteUser && isAdmin ? 'Deleted volunteer call and user' : 'Deleted volunteer call',
    });
    return;
  }

  if (body.id) {
    sendError(res, 400, 'Cannot insert a new call with an existing ID');
    return;
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const projectUrl =
    (typeof body.project_url === 'string' ? body.project_url.trim() : '') ||
    (typeof body.projectUrl === 'string' ? body.projectUrl.trim() : '');
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const rolesNeeded =
    (typeof body.roles_needed === 'string' ? body.roles_needed.trim() : '') ||
    (typeof body.rolesNeeded === 'string' ? body.rolesNeeded.trim() : '');
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  if (!title || !projectUrl || !description) {
    sendError(res, 400, 'title, project_url, and description are required');
    return;
  }
  const basePayload: Record<string, any> = {
    user_id: uid,
    title,
    project_url: projectUrl,
    description,
    roles_needed: rolesNeeded || null,
    contact: contact || null,
    status: 'open',
  };
  let { data, error } = await supabase.from('volunteer_calls').insert([basePayload]).select('id').maybeSingle();
  const missingIdDefault =
    error &&
    (String(error.message || '')
      .toLowerCase()
      .includes('null value in column "id"') || String((error as any).code || '') === '23502');
  if (missingIdDefault) {
    const uuidId = safeRandomUuid();
    ({ data, error } = await supabase
      .from('volunteer_calls')
      .insert([{ ...basePayload, id: uuidId }])
      .select('id')
      .maybeSingle());
    const uuidInvalid =
      error && /invalid input syntax for type (integer|bigint)|type (bigint|integer)/i.test(String(error.message || ''));
    if (uuidInvalid) {
      const numericId = Math.floor(Math.random() * 1000000000) + Math.floor(Date.now() % 1000000);
      ({ data, error } = await supabase
        .from('volunteer_calls')
        .insert([{ ...basePayload, id: numericId }])
        .select('id')
        .maybeSingle());
    }
  }
  if (error || !data?.id) {
    console.error('[Volunteer Calls API Error]:', error);
    sendError(res, 500, error?.message ? `Failed to create volunteer call: ${error.message}` : 'Failed to create volunteer call');
    return;
  }
  sendJson(res, 200, { message: 'Posted successfully!', id: data.id });
};
