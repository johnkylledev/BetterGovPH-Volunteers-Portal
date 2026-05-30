import { createClient } from '@supabase/supabase-js';

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

const createServiceClient = (url: string, serviceKey: string) =>
  createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const respond = (res: any, statusCode: number, data: Record<string, unknown>) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
};

const respondError = (res: any, statusCode: number, message: string) => {
  respond(res, statusCode, { error: message });
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
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method !== 'GET') {
    respondError(res, 405, 'Method not allowed');
    return;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceKey: serviceRoleKey } = getSupabaseConfig();

  if (!supabaseUrl) {
    respondError(res, 500, 'Server not configured');
    return;
  }

  const makeClient = (key: string) =>
    createClient(supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
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

  let primaryKey = supabaseAnonKey || serviceRoleKey;
  let fallbackKey = (supabaseAnonKey && serviceRoleKey && supabaseAnonKey !== serviceRoleKey) ? serviceRoleKey : '';

  if (!primaryKey) {
    respondError(res, 500, 'Server not configured');
    return;
  }

  let supabase = makeClient(primaryKey);
  let result = await runQuery(supabase);

  if (result.error && fallbackKey) {
    supabase = makeClient(fallbackKey);
    result = await runQuery(supabase);
  }

  if (result.error) {
    respondError(res, 500, 'Failed to load projects');
    return;
  }

  const projects = (result.data ?? []).map(mapProjectRow);

  respond(res, 200, { projects });
}
