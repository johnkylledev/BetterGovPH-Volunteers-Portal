import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE ||
    '';
  return { url, serviceKey };
};

const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
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

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
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

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminCheck = await assertAdmin(supabaseAdmin, token);
  if (!adminCheck.ok) {
    res.status(adminCheck.error === 'Admin only' ? 403 : 401).json({ error: adminCheck.error });
    return;
  }

  const { count: total, error: totalError } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin', false);

  if (totalError) {
    res.status(500).json({ error: 'Failed to load stats' });
    return;
  }

  const { count: pending, error: pendingError } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin', false)
    .eq('status', 'Pending');

  if (pendingError) {
    res.status(500).json({ error: 'Failed to load stats' });
    return;
  }

  const { count: approved, error: approvedError } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin', false)
    .eq('status', 'Approved');

  if (approvedError) {
    res.status(500).json({ error: 'Failed to load stats' });
    return;
  }

  res.status(200).json({
    total: total ?? 0,
    pending: pending ?? 0,
    approved: approved ?? 0,
  });
}
