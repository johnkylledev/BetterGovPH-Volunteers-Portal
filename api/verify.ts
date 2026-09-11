import { createClient } from '@supabase/supabase-js';
import { getCache, setCache } from './lib/redis';

const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
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

const createServiceClient = (url: string, serviceKey: string) =>
  createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const respond = (res: any, statusCode: number, data: Record<string, unknown>) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-API-Version', '1.0.0');
  res.end(JSON.stringify(data));
};

const respondError = (res: any, statusCode: number, message: string) => {
  respond(res, statusCode, { error: message });
};

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

  // Check Redis cache for public verification
  const cacheKey = `cache:verify:${lookup}`;
  if (!isAdminCaller) {
    try {
      const cached = await getCache<any>(cacheKey);
      if (cached) {
        respond(res, 200, cached);
        return;
      }
    } catch (err) {
      console.warn('[Verify API] Redis cache error:', err);
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
    const isApproved = ['approved', 'Approved', 'APPROVED'].includes(String(row.status ?? '')) || !!row.is_admin;
    if (!isApproved) {
      respondError(res, 404, 'Not found');
      return;
    }
  }

  const responsePayload = {
    uid: row.uid,
    fullName: row.full_name ?? '',
    specialization: row.specialization ?? '',
    role: row.role ?? 'Member',
    status: isAdminCaller ? (row.status ?? 'Pending') : 'Approved',
    memberId: row.member_id ?? null,
    yearJoined: row.year_joined ?? null,
    discordUsername: row.discord_username ?? '',
    isAdmin: !!row.is_admin,
  };

  if (!isAdminCaller) {
    try {
      await setCache(cacheKey, responsePayload, 300);
    } catch (err) {
      console.warn('[Verify API] Failed to set Redis cache:', err);
    }
  }

  respond(res, 200, responsePayload);
}
