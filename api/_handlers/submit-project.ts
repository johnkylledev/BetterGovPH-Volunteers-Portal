/**
 * api/_handlers/submit-project.ts
 * POST /submit-project — Submit a civic project
 */

import { createServiceClient } from '../_lib/http';
import { getSupabaseConfig } from '../_lib/config';
import { getBearerToken, getBody, sendJson, sendError } from '../_lib/http';
import { invalidateCache } from '../_lib/redis';
import type { H } from '../_lib/types';

let _crypto: any = null;
let _cryptoInit = false;

const tryLoadCrypto = (): any => {
  if (_cryptoInit) return _crypto;
  _cryptoInit = true;
  try {
    const req = (globalThis as any).require;
    if (typeof req === 'function') {
      const mod = req('node:crypto');
      if (mod && typeof mod.randomUUID === 'function') _crypto = mod;
    }
  } catch {
    _crypto = null;
  }
  return _crypto;
};

const safeRandomUuid = (): string => {
  try {
    const mod = tryLoadCrypto();
    if (mod && typeof mod.randomUUID === 'function') {
      const v = mod.randomUUID();
      if (typeof v === 'string' && v.length > 0) return v;
    }
  } catch {
    /* noop */
  }
  const rnd = (n: number) => {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  };
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-a${rnd(3)}-${rnd(12)}`;
};

const tryInsertSubmission = async (supabaseDb: any, basePayload: Record<string, any>) => {
  const { id: _ignoredId, ...payload } = basePayload;
  const noIdRes = await supabaseDb.from('project_submissions').insert([payload]).select('id').maybeSingle();
  if (!noIdRes.error) return { data: { id: noIdRes.data?.id || 'generated' }, error: null };
  const noIdMsg = String(noIdRes.error?.message || '').toLowerCase();
  const noIdCode = String(noIdRes.error?.code || '');
  if (!(noIdMsg.includes('null value in column "id"') || noIdCode === '23502')) return noIdRes;
  const uuidId = safeRandomUuid();
  const uuidPayload = { ...payload, id: uuidId };
  const uuidRes = await supabaseDb.from('project_submissions').insert([uuidPayload]).select('id').maybeSingle();
  if (!uuidRes.error) return { data: { id: uuidRes.data?.id || uuidId }, error: null };
  const uuidMsg = String(uuidRes.error.message || '').toLowerCase();
  const isIntIdError = /invalid input syntax for type (integer|bigint)|type (bigint|integer)/i.test(uuidMsg);
  const numericId = Math.floor(Math.random() * 1000000000) + Math.floor(Date.now() % 1000000);
  const numericPayload = { ...payload, id: numericId };
  const numRes = await supabaseDb.from('project_submissions').insert([numericPayload]).select('id').maybeSingle();
  if (!numRes.error) return { data: { id: numRes.data?.id || numericId }, error: null };
  const strPayload = { ...payload, id: String(numericId) };
  const strNumRes = await supabaseDb.from('project_submissions').insert([strPayload]).select('id').maybeSingle();
  if (!strNumRes.error) return { data: { id: strNumRes.data?.id || String(numericId) }, error: null };
  return isIntIdError ? numRes : uuidRes;
};

export const handler_submit_project: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed');
    return;
  }
  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    sendError(res, 500, `Server not configured: ${missing.join(', ')}`);
    return;
  }
  const token = getBearerToken(req.headers?.authorization);
  if (!token) {
    sendError(res, 401, 'Missing Authorization bearer token');
    return;
  }
  const supabaseAuth = createServiceClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  if (authError || !uid) {
    sendError(res, 401, 'Invalid token');
    return;
  }
  const body = getBody(req);
  const projectName =
    (typeof body.project_name === 'string' && body.project_name.trim() ? body.project_name.trim() : '') ||
    (typeof body.projectName === 'string' && body.projectName.trim() ? body.projectName.trim() : '') ||
    (typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '');
  const projectUrl =
    (typeof body.project_url === 'string' && body.project_url.trim() ? body.project_url.trim() : '') ||
    (typeof body.projectUrl === 'string' && body.projectUrl.trim() ? body.projectUrl.trim() : '') ||
    (typeof body.url === 'string' && body.url.trim() ? body.url.trim() : '');
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const projTypeRaw =
    (typeof body.proj_type === 'string' ? body.proj_type : '') ||
    (typeof body.projType === 'string' ? body.projType : '') ||
    (typeof body.project_type === 'string' ? body.project_type : '') ||
    (typeof body.tech_stack === 'string' ? body.tech_stack : '');
  const projType = projTypeRaw.trim();
  if (!projectName || !projectUrl || !description) {
    sendError(res, 400, 'project_name, project_url, and description are required');
    return;
  }
  const supabaseDb = createServiceClient(supabaseUrl, serviceRoleKey);
  let r = await tryInsertSubmission(supabaseDb, {
    user_id: uid,
    project_name: projectName,
    project_url: projectUrl,
    description,
    proj_type: projType || null,
    status: 'pending',
  });
  let data = r.data,
    error = r.error;
  if (error && String(error.message || '').toLowerCase().includes('proj_type')) {
    const r2 = await tryInsertSubmission(supabaseDb, {
      user_id: uid,
      project_name: projectName,
      project_url: projectUrl,
      description,
      tech_stack: projType || null,
      status: 'pending',
    });
    data = r2.data;
    error = r2.error;
  }
  if (
    error &&
    (String(error.message || '')
      .toLowerCase()
      .includes('proj_type') ||
      String(error.message || '')
        .toLowerCase()
        .includes('tech_stack'))
  ) {
    const r3 = await tryInsertSubmission(supabaseDb, {
      user_id: uid,
      project_name: projectName,
      project_url: projectUrl,
      description,
      status: 'pending',
    });
    data = r3.data;
    error = r3.error;
  }
  if (
    error &&
    (String(error.message || '')
      .toLowerCase()
      .includes('project_name') ||
      String(error.message || '')
        .toLowerCase()
        .includes('project_url'))
  ) {
    const r4 = await tryInsertSubmission(supabaseDb, {
      user_id: uid,
      title: projectName,
      url: projectUrl,
      description,
      proj_type: projType || null,
      status: 'pending',
    });
    data = r4.data;
    error = r4.error;
  }
  if (
    error &&
    (String(error.message || '')
      .toLowerCase()
      .includes('project_name') ||
      String(error.message || '')
        .toLowerCase()
        .includes('project_url') ||
      String(error.message || '')
        .toLowerCase()
        .includes('proj_type') ||
      String(error.message || '')
        .toLowerCase()
        .includes('tech_stack'))
  ) {
    const r5 = await tryInsertSubmission(supabaseDb, {
      user_id: uid,
      title: projectName,
      url: projectUrl,
      description,
      status: 'pending',
    });
    data = r5.data;
    error = r5.error;
  }
  if (error && String(error.message || '').toLowerCase().includes('status')) {
    const r6 = await tryInsertSubmission(supabaseDb, {
      user_id: uid,
      project_name: projectName,
      project_url: projectUrl,
      description,
    });
    data = r6.data;
    error = r6.error;
  }
  if (error || !data?.id) {
    console.error('[Submit Project API Error]:', error);
    sendError(res, 500, error?.message ? `Failed to submit project: ${error.message}` : 'Failed to submit project');
    return;
  }
  try {
    await invalidateCache('cache:admin:stats');
  } catch {
    /* noop */
  }
  sendJson(res, 200, { message: 'Submitted successfully!', submissionId: data.id });
};
