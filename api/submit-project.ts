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

const getBody = (req: any) => {
  const body = req.body ?? {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
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
    res.status(400).json({ error: 'project_name, project_url, and description are required' });
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
    const message = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
    res.status(500).json({ error: 'Failed to submit project', details: message || undefined });
    return;
  }

  res.status(200).json({ message: 'Submitted successfully!', submissionId: data.id });
}
