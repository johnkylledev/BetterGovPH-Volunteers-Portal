import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@clerk/backend';
import crypto from 'crypto';

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

const uuidV5 = (name: string, namespace: string) => {
  const ns = namespace.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(ns)) throw new Error('Invalid namespace uuid');
  const nsBytes = Buffer.from(ns, 'hex');
  const nameBytes = Buffer.from(name, 'utf8');
  const hash = crypto.createHash('sha1').update(nsBytes).update(nameBytes).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    res.status(500).json({ error: 'Server not configured', missing: ['CLERK_SECRET_KEY'] });
    return;
  }
  const verified = await verifyToken(token, { secretKey: clerkSecretKey }).catch(() => null);
  const clerkUserId = typeof (verified as any)?.sub === 'string' ? String((verified as any).sub) : '';
  if (!clerkUserId) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  const callerUid = uuidV5(clerkUserId, 'a6d53c49-7ee9-4cd5-a5b1-6d33c0a8f5b1');

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
