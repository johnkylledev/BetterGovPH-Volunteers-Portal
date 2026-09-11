import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { invalidateCache } from '../_lib/redis';

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
  res.setHeader('X-API-Version', '1.0.0');
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

  const projectName =
    typeof body.project_name === 'string' && body.project_name.trim()
      ? body.project_name.trim()
      : typeof body.projectName === 'string' && body.projectName.trim()
        ? body.projectName.trim()
        : typeof body.title === 'string' && body.title.trim()
          ? body.title.trim()
          : '';

  const projectUrl =
    typeof body.project_url === 'string' && body.project_url.trim()
      ? body.project_url.trim()
      : typeof body.projectUrl === 'string' && body.projectUrl.trim()
        ? body.projectUrl.trim()
        : typeof body.url === 'string' && body.url.trim()
          ? body.url.trim()
          : '';
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

  const tryInsert = async (basePayload: Record<string, any>) => {
    // Strip any existing id from payload to avoid overriding generated ID
    const { id: _ignoredId, ...payload } = basePayload;

    // Strategy 1: Omit ID (let PostgreSQL default / identity / sequence auto-generate)
    // This is the cleanest path if the table has a default (e.g. gen_random_uuid()).
    const noIdRes = await supabaseDb
      .from('project_submissions')
      .insert([payload])
      .select('id')
      .maybeSingle();

    if (!noIdRes.error) {
      return { data: { id: noIdRes.data?.id || 'generated' }, error: null };
    }

    const noIdErrMsg = String(noIdRes.error?.message || '').toLowerCase();
    const noIdErrorCode = String(noIdRes.error?.code || '');
    const idHasNoDefault = noIdErrMsg.includes('null value in column "id"') || noIdErrorCode === '23502';

    // If failure is anything other than "id has no default", return it directly.
    if (!idHasNoDefault) {
      return noIdRes;
    }

    // Strategy 2: UUID string ID (for columns without a gen_random_uuid() default)
    let uuidId: string;
    try {
      uuidId = randomUUID();
    } catch {
      uuidId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    const uuidPayload = { ...payload, id: uuidId };
    const uuidRes = await supabaseDb
      .from('project_submissions')
      .insert([uuidPayload])
      .select('id')
      .maybeSingle();

    if (!uuidRes.error) {
      return { data: { id: uuidRes.data?.id || uuidId }, error: null };
    }

    const uuidErrMsg = String(uuidRes.error.message || '').toLowerCase();
    const isIntegerIdError =
      uuidErrMsg.includes('invalid input syntax for type integer') ||
      uuidErrMsg.includes('invalid input syntax for type bigint') ||
      uuidErrMsg.includes('type bigint') ||
      uuidErrMsg.includes('type integer') ||
      uuidErrMsg.includes('bigint');

    // Strategy 3: Numeric ID (int4 / int8 / bigint PK)
    const numericId = Math.floor(Math.random() * 1000000000) + Math.floor(Date.now() % 1000000);
    const numericPayload = { ...payload, id: numericId };
    const numRes = await supabaseDb
      .from('project_submissions')
      .insert([numericPayload])
      .select('id')
      .maybeSingle();

    if (!numRes.error) {
      return { data: { id: numRes.data?.id || numericId }, error: null };
    }

    // Strategy 4: String-numeric ID (text/varchar PK expecting digits)
    const strNumericPayload = { ...payload, id: String(numericId) };
    const strNumRes = await supabaseDb
      .from('project_submissions')
      .insert([strNumericPayload])
      .select('id')
      .maybeSingle();

    if (!strNumRes.error) {
      return { data: { id: strNumRes.data?.id || String(numericId) }, error: null };
    }

    // Prefer the most relevant failure (omit-id result was already "id has no default"
    // which isn't the user's problem — surface whichever generated-id attempt failed last).
    if (isIntegerIdError) {
      return numRes;
    }
    return uuidRes;
  };

  // Attempt 1: standard project_name, project_url, proj_type
  let res1 = await tryInsert({
    user_id: uid,
    project_name: projectName,
    project_url: projectUrl,
    description,
    proj_type: projType || null,
    status: 'pending',
  });

  let data = res1.data;
  let error = res1.error;

  // Attempt 2: fallback to tech_stack
  if (error && String(error.message || '').toLowerCase().includes('proj_type')) {
    const res2 = await tryInsert({
      user_id: uid,
      project_name: projectName,
      project_url: projectUrl,
      description,
      tech_stack: projType || null,
      status: 'pending',
    });
    data = res2.data;
    error = res2.error;
  }

  // Attempt 3: fallback to omitting category column entirely if neither proj_type nor tech_stack column exists
  if (error && (String(error.message || '').toLowerCase().includes('proj_type') || String(error.message || '').toLowerCase().includes('tech_stack'))) {
    const res3 = await tryInsert({
      user_id: uid,
      project_name: projectName,
      project_url: projectUrl,
      description,
      status: 'pending',
    });
    data = res3.data;
    error = res3.error;
  }

  // Attempt 4: fallback to title and url
  if (error && (String(error.message || '').toLowerCase().includes('project_name') || String(error.message || '').toLowerCase().includes('project_url'))) {
    const res4 = await tryInsert({
      user_id: uid,
      title: projectName,
      url: projectUrl,
      description,
      proj_type: projType || null,
      status: 'pending',
    });
    data = res4.data;
    error = res4.error;
  }

  // Attempt 5: title, url without proj_type
  if (error && (String(error.message || '').toLowerCase().includes('project_name') || String(error.message || '').toLowerCase().includes('project_url') || String(error.message || '').toLowerCase().includes('proj_type') || String(error.message || '').toLowerCase().includes('tech_stack'))) {
    const res5 = await tryInsert({
      user_id: uid,
      title: projectName,
      url: projectUrl,
      description,
      status: 'pending',
    });
    data = res5.data;
    error = res5.error;
  }

  // Attempt 6: minimal payload without status (in case status column doesn't exist or has default)
  if (error && String(error.message || '').toLowerCase().includes('status')) {
    const res6 = await tryInsert({
      user_id: uid,
      project_name: projectName,
      project_url: projectUrl,
      description,
    });
    data = res6.data;
    error = res6.error;
  }

  if (error || !data?.id) {
    console.error('[Submit Project API Error]:', error);
    respondError(res, 500, error?.message ? `Failed to submit project: ${error.message}` : 'Failed to submit project');
    return;
  }

  try {
    await invalidateCache('cache:admin:stats');
  } catch (err) {
    console.warn('[Submit Project API] Failed to invalidate cache:', err);
  }

  respond(res, 200, { message: 'Submitted successfully!', submissionId: data.id });
}

