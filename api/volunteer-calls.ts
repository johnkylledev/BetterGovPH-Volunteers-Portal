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

const assertAdmin = async (supabaseAdmin: any, token: string) => {
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    const message = typeof (authError as any)?.message === 'string' ? String((authError as any).message) : '';
    return { ok: false as const, error: message || 'Invalid token' };
  }

  const uid = authData.user.id;
  const { data: callerRow, error: callerError } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('uid', uid)
    .maybeSingle();

  if (callerError) return { ok: false as const, error: 'Failed to validate admin' };
  if (!callerRow?.is_admin) return { ok: false as const, error: 'Admin only' };
  return { ok: true as const };
};

const mapCallRow = (row: any, postedBy?: { fullName: string; email: string }) => ({
  id: row.id,
  userId: row.user_id,
  title: row.title ?? '',
  projectUrl: row.project_url ?? '',
  description: row.description ?? '',
  rolesNeeded: row.roles_needed ?? undefined,
  contact: row.contact ?? undefined,
  status: row.status ?? 'open',
  createdAt: row.created_at,
  postedBy,
});

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
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
  let supabaseDb = serviceRoleKey ? makeClient(serviceRoleKey) : makeClient(primaryKey, token);
  const prefersService = !!serviceRoleKey;

  if (req.method === 'GET') {
    const mine = getStringParam(req.query?.mine);
    const adminMode = getStringParam(req.query?.admin);
    const wantsAdmin = adminMode === '1' || adminMode === 'true';
    const statusFilter = getStringParam(req.query?.status);

    if (wantsAdmin) {
      let supabaseAdmin = makeClient(primaryKey, primaryKey === supabaseAnonKey ? token : undefined);
      let adminCheck = await assertAdmin(supabaseAdmin, token);
      if (
        !adminCheck.ok &&
        fallbackKey &&
        typeof (adminCheck as any)?.error === 'string' &&
        String((adminCheck as any).error).toLowerCase().includes('invalid api key')
      ) {
        supabaseAdmin = makeClient(fallbackKey, token);
        adminCheck = await assertAdmin(supabaseAdmin, token);
      }
      if (!adminCheck.ok) {
        res.status(adminCheck.error === 'Admin only' ? 403 : 401).json({ error: adminCheck.error });
        return;
      }
      supabaseDb = supabaseAdmin;
    }

    let query = supabaseDb.from('volunteer_calls').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (mine === '1' || mine === 'true') query = query.eq('user_id', uid);
    if (!wantsAdmin && mine !== '1' && mine !== 'true') query = query.eq('status', 'open');
    if (wantsAdmin && statusFilter && statusFilter !== 'All') query = query.eq('status', statusFilter);

    let { data, error, count } = await query.limit(50);
    if (
      error &&
      prefersService &&
      typeof (error as any)?.message === 'string' &&
      String((error as any).message).toLowerCase().includes('invalid api key')
    ) {
      supabaseDb = makeClient(primaryKey, token);
      query = supabaseDb.from('volunteer_calls').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (mine === '1' || mine === 'true') {
        query = query.eq('user_id', uid);
      } else {
        query = query.eq('status', 'open');
      }
      const retry = await query.limit(50);
      data = retry.data;
      error = retry.error;
      count = (retry as any).count;
    }
    if (error) {
      const message = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
      res.status(500).json({ error: 'Failed to load volunteer calls', details: message || undefined });
      return;
    }

    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    const userMap = new Map<string, { fullName: string; email: string }>();
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabaseDb.from('users').select('uid, full_name, email').in('uid', userIds);
      if (!usersError) {
        for (const u of usersData ?? []) {
          userMap.set(u.uid, { fullName: u.full_name ?? '', email: u.email ?? '' });
        }
      }
    }

    res.status(200).json({
      calls: rows.map((r: any) => mapCallRow(r, userMap.get(r.user_id))),
      totalCount: count ?? 0,
    });
    return;
  }

  if (req.method === 'DELETE') {
    const body = getBody(req);
    const id = typeof body.id === 'string' ? body.id : getStringParam(req.query?.id) || '';
    const deleteUser = typeof body.deleteUser === 'boolean' ? body.deleteUser : false;
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    let supabaseAdmin = makeClient(primaryKey, primaryKey === supabaseAnonKey ? token : undefined);
    let adminCheck = await assertAdmin(supabaseAdmin, token);
    if (
      !adminCheck.ok &&
      fallbackKey &&
      typeof (adminCheck as any)?.error === 'string' &&
      String((adminCheck as any).error).toLowerCase().includes('invalid api key')
    ) {
      supabaseAdmin = makeClient(fallbackKey, token);
      adminCheck = await assertAdmin(supabaseAdmin, token);
    }
    if (!adminCheck.ok) {
      res.status(adminCheck.error === 'Admin only' ? 403 : 401).json({ error: adminCheck.error });
      return;
    }

    const { data: call, error: callError } = await supabaseAdmin
      .from('volunteer_calls')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (callError) {
      res.status(500).json({ error: 'Failed to load volunteer call' });
      return;
    }
    if (!call) {
      res.status(404).json({ error: 'Volunteer call not found' });
      return;
    }

    const { error: deleteError } = await supabaseAdmin.from('volunteer_calls').delete().eq('id', id);
    if (deleteError) {
      res.status(500).json({ error: 'Failed to delete volunteer call' });
      return;
    }

    if (deleteUser) {
      const userId = typeof (call as any).user_id === 'string' ? String((call as any).user_id) : '';
      if (userId) {
        await supabaseAdmin.from('project_submissions').delete().eq('user_id', userId);
        await supabaseAdmin.from('volunteer_calls').delete().eq('user_id', userId);
        await supabaseAdmin.from('users').delete().eq('uid', userId);
        if (serviceRoleKey) {
          const serviceClient = makeClient(serviceRoleKey);
          try {
            await (serviceClient as any).auth.admin.deleteUser(userId);
          } catch {
            res.status(200).json({ message: 'Deleted volunteer call and user (auth delete skipped)' });
            return;
          }
        }
      }
    }

    res.status(200).json({ message: deleteUser ? 'Deleted volunteer call and user' : 'Deleted volunteer call' });
    return;
  }

  const body = getBody(req);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const projectUrl = typeof body.project_url === 'string' ? body.project_url.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const rolesNeeded = typeof body.roles_needed === 'string' ? body.roles_needed.trim() : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';

  if (!title || !projectUrl || !description) {
    res.status(400).json({ error: 'title, project_url, and description are required' });
    return;
  }

  let { data, error } = await supabaseDb
    .from('volunteer_calls')
    .insert([
      {
        user_id: uid,
        title,
        project_url: projectUrl,
        description,
        roles_needed: rolesNeeded || null,
        contact: contact || null,
        status: 'open',
      },
    ])
    .select('id')
    .maybeSingle();

  if (
    error &&
    prefersService &&
    typeof (error as any)?.message === 'string' &&
    String((error as any).message).toLowerCase().includes('invalid api key')
  ) {
    supabaseDb = makeClient(primaryKey, token);
    const retry = await supabaseDb
      .from('volunteer_calls')
      .insert([
        {
          user_id: uid,
          title,
          project_url: projectUrl,
          description,
          roles_needed: rolesNeeded || null,
          contact: contact || null,
          status: 'open',
        },
      ])
      .select('id')
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data?.id) {
    const message = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
    res.status(500).json({ error: 'Failed to create volunteer call', details: message || undefined });
    return;
  }

  res.status(200).json({ message: 'Posted successfully!', id: data.id });
}
