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
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceKey: serviceRoleKey } = getSupabaseConfig();
  const primaryKey = supabaseAnonKey || serviceRoleKey;
  const fallbackKey = supabaseAnonKey && serviceRoleKey && supabaseAnonKey !== serviceRoleKey ? serviceRoleKey : '';

  if (!supabaseUrl || !primaryKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!primaryKey) missing.push('SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
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

  let supabaseAuth = makeClient(primaryKey);
  let { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
  if (
    authError &&
    fallbackKey &&
    typeof (authError as any)?.message === 'string' &&
    String((authError as any).message).toLowerCase().includes('invalid api key')
  ) {
    supabaseAuth = makeClient(fallbackKey);
    const retry = await supabaseAuth.auth.getUser(token);
    authData = retry.data;
    authError = retry.error;
  }
  if (authError || !authData?.user) {
    const message = typeof (authError as any)?.message === 'string' ? String((authError as any).message) : '';
    res.status(401).json({ error: message || 'Invalid token' });
    return;
  }

  const uid = authData.user.id;
  const page = Math.max(0, getNumberParam(req.query?.page, 0));
  const pageSize = Math.min(100, Math.max(1, getNumberParam(req.query?.pageSize, 20)));

  let supabaseDb = serviceRoleKey ? makeClient(serviceRoleKey) : makeClient(primaryKey, token);
  const prefersService = !!serviceRoleKey;

  const runQuery = async () =>
    supabaseDb
      .from('project_submissions')
      .select('*', { count: 'exact' })
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

  let result = await runQuery();

  if (
    result.error &&
    prefersService &&
    typeof (result.error as any)?.message === 'string' &&
    String((result.error as any).message).toLowerCase().includes('invalid api key')
  ) {
    supabaseDb = makeClient(primaryKey, token);
    result = await runQuery();
  }

  if (result.error) {
    const message = typeof (result.error as any)?.message === 'string' ? String((result.error as any).message) : '';
    res.status(500).json({ error: 'Failed to load submissions', details: message || undefined });
    return;
  }

  res.status(200).json({
    submissions: (result.data ?? []).map(mapSubmissionRow),
    totalCount: result.count ?? 0,
  });
}
