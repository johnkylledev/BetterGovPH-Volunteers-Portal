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

  let supabase = serviceRoleKey ? makeClient(serviceRoleKey) : makeClient(primaryKey, token || undefined);
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

  res.status(200).json({ projects: (result.data ?? []).map(mapProjectRow) });
}
