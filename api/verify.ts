import { createClient } from '@supabase/supabase-js';
import {
  getSupabaseConfig,
  getBearerToken,
  getStringParam,
  createServiceClient,
  isUuid,
  respondError,
  respond,
} from './_lib/supabase';

const normalizeLookupId = (raw: string) => raw.trim().toUpperCase();

const isSafeMemberId = (value: string) => /^BGPH-\d{4}-\d{3}$/i.test(value);

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    respondError(res, 405, 'Method not allowed');
    return;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    respondError(res, 500, 'Server not configured');
    return;
  }

  const queryId = getStringParam(req.query?.id ?? req.query?.memberId);
  const bodyId = getStringParam(req.body?.id ?? req.body?.memberId);
  const lookupRaw = queryId ?? bodyId;

  if (!lookupRaw) {
    respondError(res, 400, 'Missing id (memberId)');
    return;
  }

  const lookup = normalizeLookupId(lookupRaw);

  if (!isSafeMemberId(lookup) && !isUuid(lookupRaw.trim())) {
    respondError(res, 400, 'Invalid id format');
    return;
  }

  const token = getBearerToken(req.headers?.authorization);
  let isAdminCaller = false;
  if (token && serviceRoleKey) {
    try {
      const adminSupabase = createServiceClient(supabaseUrl, serviceRoleKey);
      const { data: authData } = await adminSupabase.auth.getUser(token);
      if (authData?.user) {
        const callerUid = authData.user.id;
        const { data: callerRow } = await adminSupabase
          .from('users')
          .select('is_admin')
          .eq('uid', callerUid)
          .maybeSingle();
        isAdminCaller = !!callerRow?.is_admin;
      }
    } catch {
      isAdminCaller = false;
    }
  }

  const anonSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let row: any | null = null;

  const exactMemberId = lookup.startsWith('BGPH-') ? lookup : `BGPH-${lookup}`;

  if (isSafeMemberId(exactMemberId)) {
    const { data, error } = await anonSupabase
      .from('users')
      .select('uid, full_name, specialization, role, status, member_id, year_joined, discord_username, is_admin')
      .eq('member_id', exactMemberId)
      .maybeSingle();

    if (error) {
      respondError(res, 500, 'Lookup failed');
      return;
    }

    row = data ?? null;
  }

  if (!row && isAdminCaller && isUuid(lookupRaw.trim())) {
    const { data, error } = await anonSupabase
      .from('users')
      .select('uid, full_name, specialization, role, status, member_id, year_joined, discord_username, is_admin')
      .eq('uid', lookupRaw.trim())
      .maybeSingle();

    if (error) {
      respondError(res, 500, 'Lookup failed');
      return;
    }

    row = data ?? null;
  }

  if (!row) {
    respondError(res, 404, 'Not found');
    return;
  }

  if (!isAdminCaller) {
    const isApproved = row.status === 'Approved' || !!row.is_admin;
    if (!isApproved) {
      respondError(res, 404, 'Not found');
      return;
    }
  }

  respond(res, 200, {
    uid: row.uid,
    fullName: row.full_name ?? '',
    specialization: row.specialization ?? '',
    role: row.role ?? 'Member',
    status: isAdminCaller ? (row.status ?? 'Pending') : 'Approved',
    memberId: row.member_id ?? null,
    yearJoined: row.year_joined ?? null,
    discordUsername: row.discord_username ?? '',
    isAdmin: !!row.is_admin,
  });
}
