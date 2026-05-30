import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
  return { url, serviceKey };
};

const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const getBody = (req: any) => {
  const body = req.body ?? {};
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return body;
};

const respond = (res: any, statusCode: number, data: Record<string, unknown>) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
};

const respondError = (res: any, statusCode: number, message: string) => {
  respond(res, statusCode, { error: message });
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    respondError(res, 405, 'Method not allowed');
    return;
  }

  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    respondError(res, 500, `Server not configured: ${missing.join(', ')}`);
    return;
  }

  const token = getBearerToken(req.headers?.authorization);
  if (!token) {
    respondError(res, 401, 'Missing Authorization bearer token');
    return;
  }

  const supabaseAuth = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  if (authError || !uid) {
    respondError(res, 401, 'Invalid token');
    return;
  }

  const body = getBody(req);

  const projectName = typeof body.project_name === 'string' ? body.project_name.trim() : '';
  const projectUrl = typeof body.project_url === 'string' ? body.project_url.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const projTypeRaw =
    typeof body.proj_type === 'string'
      ? body.proj_type
      : typeof body.projType === 'string'
        ? body.projType
        : typeof body.project_type === 'string'
          ? body.project_type
          : typeof body.tech_stack === 'string'
            ? body.tech_stack
            : '';
  const projType = projTypeRaw.trim();

  if (!projectName || !projectUrl || !description) {
    respondError(res, 400, 'project_name, project_url, and description are required');
    return;
  }

  const supabaseDb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const insertWithProjType = async () =>
    supabaseDb
      .from('project_submissions')
      .insert([
        {
          user_id: uid,
          project_name: projectName,
          project_url: projectUrl,
          description,
          proj_type: projType || null,
          status: 'pending',
        },
      ])
      .select('id')
      .maybeSingle();

  const insertWithTechStack = async () =>
    supabaseDb
      .from('project_submissions')
      .insert([
        {
          user_id: uid,
          project_name: projectName,
          project_url: projectUrl,
          description,
          tech_stack: projType || null,
          status: 'pending',
        },
      ])
      .select('id')
      .maybeSingle();

  let { data, error } = await insertWithProjType();
  if (
    error &&
    typeof (error as any)?.message === 'string' &&
    String((error as any).message).toLowerCase().includes('proj_type')
  ) {
    const retry = await insertWithTechStack();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data?.id) {
    respondError(res, 500, 'Failed to submit project');
    return;
  }

  respond(res, 200, { message: 'Submitted successfully!', submissionId: data.id });
}
