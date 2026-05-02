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

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
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

  const token = getBearerToken(req.headers?.authorization);
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return;
  }

  const supabaseAuth = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  if (authError || !uid) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerRow } = await supabaseAdmin.from('users').select('is_admin').eq('uid', uid).maybeSingle();
  if (!callerRow?.is_admin) {
    res.status(403).json({ error: 'Admin only' });
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
    .eq('is_admin', false);

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
}

