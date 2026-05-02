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

  const supabaseDb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerRow } = await supabaseDb.from('users').select('is_admin').eq('uid', uid).maybeSingle();
  const isAdmin = !!callerRow?.is_admin;

  if (req.method === 'GET') {
    const mine = getStringParam(req.query?.mine);
    const adminMode = getStringParam(req.query?.admin);
    const wantsAdmin = adminMode === '1' || adminMode === 'true';
    const statusFilter = getStringParam(req.query?.status);

    if (wantsAdmin && !isAdmin) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    let query = supabaseDb.from('volunteer_calls').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (mine === '1' || mine === 'true') query = query.eq('user_id', uid);
    if (!wantsAdmin && mine !== '1' && mine !== 'true') query = query.eq('status', 'open');
    if (wantsAdmin && statusFilter && statusFilter !== 'All') query = query.eq('status', statusFilter);

    const { data, error, count } = await query.limit(50);
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

    if (!isAdmin) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const { data: call, error: callError } = await supabaseDb
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

    const { error: deleteError } = await supabaseDb.from('volunteer_calls').delete().eq('id', id);
    if (deleteError) {
      res.status(500).json({ error: 'Failed to delete volunteer call' });
      return;
    }

    if (deleteUser) {
      const userId = typeof (call as any).user_id === 'string' ? String((call as any).user_id) : '';
      if (userId) {
        await supabaseDb.from('project_submissions').delete().eq('user_id', userId);
        await supabaseDb.from('volunteer_calls').delete().eq('user_id', userId);
        await supabaseDb.from('users').delete().eq('uid', userId);
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

  const { data, error } = await supabaseDb
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

  if (error || !data?.id) {
    const message = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
    res.status(500).json({ error: 'Failed to create volunteer call', details: message || undefined });
    return;
  }

  res.status(200).json({ message: 'Posted successfully!', id: data.id });
}
