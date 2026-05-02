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

const assertAdmin = async (supabaseAdmin: any, uid: string) => {
  const { data: callerRow, error: callerError } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('uid', uid)
    .maybeSingle();
  if (callerError) return { ok: false as const, error: 'Failed to validate admin' };
  if (!callerRow?.is_admin) return { ok: false as const, error: 'Admin only' };
  return { ok: true as const };
};

const generateUniqueMemberId = async (supabaseAdmin: any, selectedYear: number) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('member_id')
    .ilike('member_id', `%-${selectedYear}-%`)
    .order('member_id', { ascending: false })
    .limit(50);

  if (error) throw error;

  let maxSequence = 0;
  for (const u of data ?? []) {
    const memberId = u.member_id;
    if (typeof memberId !== 'string') continue;
    const parts = memberId.split('-');
    const seqStr = parts[parts.length - 1];
    const seq = parseInt(seqStr, 10);
    if (!isNaN(seq) && seq > maxSequence) maxSequence = seq;
  }

  const nextSequence = maxSequence + 1;
  return `BGPH-${selectedYear}-${String(nextSequence).padStart(3, '0')}`;
};

const ensureUserHasMemberId = async (supabaseAdmin: any, uid: string) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('member_id, year_joined')
    .eq('uid', uid)
    .maybeSingle();

  if (error) throw error;
  if (data?.member_id) return data.member_id as string;

  const yearJoined = data?.year_joined || new Date().getFullYear();
  const memberId = await generateUniqueMemberId(supabaseAdmin, yearJoined);
  await supabaseAdmin
    .from('users')
    .update({ member_id: memberId, updated_at: new Date().toISOString() })
    .eq('uid', uid);

  return memberId;
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    res.status(500).json({ error: 'Server not configured', missing });
    return;
  }

  const token = getBearerToken(req.headers?.authorization);
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return;
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
  const callerUid = authData?.user?.id ? String(authData.user.id) : '';
  if (authError || !callerUid) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminCheck = await assertAdmin(supabaseAdmin, callerUid);
  if (!adminCheck.ok) {
    res.status(adminCheck.error === 'Admin only' ? 403 : 401).json({ error: adminCheck.error });
    return;
  }

  const body = req.body ?? {};
  const uid = typeof body.uid === 'string' ? body.uid : typeof body.id === 'string' ? body.id : null;
  const status = typeof body.status === 'string' ? body.status : null;
  const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : undefined;

  if (!uid || !status) {
    res.status(400).json({ error: 'Missing uid and/or status' });
    return;
  }

  const updates: any = { status, updated_at: new Date().toISOString() };
  if (adminNotes !== undefined) updates.admin_notes = adminNotes;

  let memberId: string | undefined;
  if (status === 'Approved') {
    try {
      memberId = await ensureUserHasMemberId(supabaseAdmin, uid);
      updates.member_id = memberId;
    } catch {
      res.status(500).json({ error: 'Failed to generate memberId' });
      return;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('uid', uid)
    .select('*');

  if (error) {
    res.status(500).json({ error: 'Failed to update user' });
    return;
  }

  if (!data || data.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.status(200).json({ memberId: memberId ?? data[0]?.member_id ?? null });
}
