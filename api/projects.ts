import { createClient } from '@supabase/supabase-js';

const firstEnv = (keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) return { key, value: value.trim() };
  }
  return { key: '', value: '' };
};

const getSupabaseConfig = () => {
  const urlPick = firstEnv(['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
  const anonKeyPick = firstEnv(['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
  const serviceKeyPick = firstEnv([
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SUPABASE_SERVICE_ROLE',
    'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE',
  ]);
  return {
    url: urlPick.value,
    anonKey: anonKeyPick.value,
    serviceKey: serviceKeyPick.value,
    sources: {
      url: urlPick.key,
      anonKey: anonKeyPick.key,
      serviceKey: serviceKeyPick.key,
    },
  };
};

const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const normalizeUrl = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.replace(/`/g, '').trim();
};

const mapProjectRow = (row: any) => ({
   id: row.id,
  title: row.project_name ?? row.title ?? '',
  description: row.description ?? '',
  url: normalizeUrl(row.project_url ?? row.url ?? ''),
  projType: row.proj_type ?? row.tech_stack ?? undefined,
  createdAt: row.created_at ?? undefined,
});

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceKey: serviceRoleKey, sources } = getSupabaseConfig();
  const primaryKey = supabaseAnonKey || serviceRoleKey;
  const fallbackKey = supabaseAnonKey && serviceRoleKey && supabaseAnonKey !== serviceRoleKey ? serviceRoleKey : '';
  const debug = String(req?.query?.debug ?? '') === '1';
  const canDebug = debug && String(process.env.NODE_ENV || '').toLowerCase() !== 'production';
  const supabaseHost = (() => {
    try {
      return new URL(supabaseUrl).host;
    } catch {
      return '';
    }
  })();
  const keyTail = (v: string) => (typeof v === 'string' && v.length >= 6 ? v.slice(-6) : '');

  if (!supabaseUrl || !primaryKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!primaryKey) missing.push('SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
    res.status(500).json({ error: 'Server not configured', missing });
    return;
  }

  if (!serviceRoleKey) {
    res.status(500).json({
      error: 'Server not configured',
      missing: ['SUPABASE_SERVICE_ROLE_KEY'],
      details: 'Public projects list requires a service role key (or a public RLS policy on project_submissions).',
    });
    return;
  }

  if (serviceRoleKey === supabaseAnonKey) {
    res.status(500).json({
      error: 'Server misconfigured',
      details: 'SUPABASE_SERVICE_ROLE_KEY is the same as SUPABASE_ANON_KEY. Set the real service_role key from Supabase Dashboard → Settings → API.',
    });
    return;
  }

  const token = getBearerToken(req.headers?.authorization);

  const makeClient = (key: string, bearerToken?: string) =>
    createClient(supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: bearerToken ? { headers: { Authorization: `Bearer ${bearerToken}` } } : undefined,
    });

  const runQuery = async (client: any) => {
    let result = await client
      .from('project_submissions')
      .select('*')
      .in('status', ['approved', 'Approved', 'APPROVED'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (
      result.error &&
      typeof (result.error as any)?.message === 'string' &&
      String((result.error as any).message).toLowerCase().includes('created_at')
    ) {
      result = await client
        .from('project_submissions')
        .select('*')
        .in('status', ['approved', 'Approved', 'APPROVED'])
        .order('id', { ascending: false })
        .limit(100);
    }
    return result;
  };

  let supabase = makeClient(serviceRoleKey);
  let result = await runQuery(supabase);

  if (
    result.error &&
    serviceRoleKey &&
    typeof (result.error as any)?.message === 'string' &&
    String((result.error as any).message).toLowerCase().includes('invalid api key')
  ) {
    supabase = makeClient(primaryKey, token || undefined);
    result = await runQuery(supabase);
  }

  if (
    result.error &&
    fallbackKey &&
    typeof (result.error as any)?.message === 'string' &&
    String((result.error as any).message).toLowerCase().includes('invalid api key')
  ) {
    supabase = makeClient(fallbackKey, token || undefined);
    result = await runQuery(supabase);
  }

  if (result.error) {
    const message = typeof (result.error as any)?.message === 'string' ? String((result.error as any).message) : '';
    res.status(500).json({ error: 'Failed to load projects', details: message || undefined });
    return;
  }

  const projects = (result.data ?? []).map(mapProjectRow);

  if (!canDebug) {
    res.status(200).json({ projects });
    return;
  }

  const safeError = (e: any) => (typeof e?.message === 'string' ? e.message : typeof e === 'string' ? e : '');
  const totalCountRes = await supabase
    .from('project_submissions')
    .select('id', { count: 'exact', head: true });
  const approvedCountRes = await supabase
    .from('project_submissions')
    .select('id', { count: 'exact', head: true })
    .in('status', ['approved', 'Approved', 'APPROVED']);
  const anyRowsRes = await supabase
    .from('project_submissions')
    .select('id, project_name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(3);
  const adminProbe = await (async () => {
    try {
      await (supabase as any).auth.admin.listUsers({ page: 1, perPage: 1 });
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, error: safeError(e) };
    }
  })();

  res.status(200).json({
    projects,
    debug: {
      supabaseHost,
      usingServiceRole: true,
      envSources: sources,
      anonKeyTail: keyTail(supabaseAnonKey),
      serviceRoleKeyTail: keyTail(serviceRoleKey),
      serviceRoleAdminOk: adminProbe.ok,
      serviceRoleAdminError: adminProbe.ok ? '' : adminProbe.error,
      totalCount: totalCountRes.count ?? null,
      approvedCount: approvedCountRes.count ?? null,
      totalCountError: safeError(totalCountRes.error),
      approvedCountError: safeError(approvedCountRes.error),
      anyRowsError: safeError(anyRowsRes.error),
      anyRows: Array.isArray(anyRowsRes.data) ? anyRowsRes.data : [],
    },
  });
}
