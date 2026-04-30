import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE ||
    '';
  return { url, serviceKey };
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

const normalizeLookupId = (raw: string) => raw.trim().toUpperCase();

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const isSafeLookup = (value: string) => /^[A-Z0-9-]{3,60}$/.test(value);

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    res.status(500).json({ error: 'Server not configured', missing });
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = getBearerToken(req.headers?.authorization);
  let isAdminCaller = false;
  if (token) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (!authError && authData?.user) {
      const callerUid = authData.user.id;
      const { data: callerRow } = await supabaseAdmin
        .from('users')
        .select('is_admin')
        .eq('uid', callerUid)
        .maybeSingle();
      isAdminCaller = !!callerRow?.is_admin;
    }
  }

  const queryId = getStringParam(req.query?.id ?? req.query?.memberId);
  const bodyId = getStringParam(req.body?.id ?? req.body?.memberId);
  const lookupRaw = queryId ?? bodyId;

  if (!lookupRaw) {
    res.status(400).json({ error: 'Missing id (memberId)' });
    return;
  }

  const lookup = normalizeLookupId(lookupRaw);
  if (!isSafeLookup(lookup) && !isUuid(lookupRaw.trim())) {
    res.status(400).json({ error: 'Invalid id format' });
    return;
  }

  let row: any | null = null;

  const upperId = lookup;
  const cleanId = upperId.startsWith('BGPH-') ? upperId.replace('BGPH-', '') : upperId;
  const prefixedId = upperId.startsWith('BGPH-') ? upperId : `BGPH-${upperId}`;

  const { data: byMember, error: byMemberError } = await supabaseAdmin
    .from('users')
    .select('uid, full_name, specialization, role, status, member_id, year_joined, discord_username, is_admin')
    .or(`member_id.ilike.${upperId},member_id.ilike.${cleanId},member_id.ilike.${prefixedId}`)
    .maybeSingle();

  if (byMemberError) {
    res.status(500).json({ error: 'Lookup failed' });
    return;
  }

  if (byMember) {
    row = byMember;
  } else if (isAdminCaller && isUuid(lookupRaw.trim())) {
    const { data: byUid, error: byUidError } = await supabaseAdmin
      .from('users')
      .select('uid, full_name, specialization, role, status, member_id, year_joined, discord_username, is_admin')
      .eq('uid', lookupRaw.trim())
      .maybeSingle();

    if (byUidError) {
      res.status(500).json({ error: 'Lookup failed' });
      return;
    }

    row = byUid ?? null;
  }

  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  if (!isAdminCaller) {
    const isApproved = row.status === 'Approved' || !!row.is_admin;
    if (!isApproved) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
  }

  res.status(200).json({
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
