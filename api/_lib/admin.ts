/**
 * api/_lib/admin.ts
 * Member ID generation and admin guard checks
 */

export const generateUniqueMemberId = async (client: any, selectedYear: number) => {
  const { data, error } = await client
    .from('users')
    .select('member_id')
    .ilike('member_id', `BGPH-${selectedYear}-%`)
    .order('member_id', { ascending: false })
    .limit(100);
  if (error) throw error;
  let maxSequence = 0;
  for (const u of data ?? []) {
    const m = typeof u.member_id === 'string' ? u.member_id.match(/^BGPH-(\d{4})-(\d{3})$/) : null;
    if (m && parseInt(m[1]) === selectedYear) {
      const seq = parseInt(m[2], 10);
      if (!isNaN(seq) && seq > maxSequence) maxSequence = seq;
    }
  }
  const next = `BGPH-${selectedYear}-${String(maxSequence + 1).padStart(3, '0')}`;
  const { data: dup } = await client.from('users').select('member_id').eq('member_id', next).maybeSingle();
  if (!dup) return next;
  throw new Error('Failed to generate unique member ID');
};

export const ensureUserHasMemberId = async (client: any, uid: string) => {
  const { data, error } = await client.from('users').select('member_id, year_joined').eq('uid', uid).maybeSingle();
  if (error) throw error;
  if (data?.member_id) return data.member_id as string;
  const y = data?.year_joined || new Date().getFullYear();
  const id = await generateUniqueMemberId(client, y);
  await client.from('users').update({ member_id: id, updated_at: new Date().toISOString() }).eq('uid', uid);
  return id;
};

export interface AdminCheckResult {
  ok: boolean;
  error?: string;
}

export const assertAdmin = async (supabaseAdmin: any, uid: string, email?: string): Promise<AdminCheckResult> => {
  let { data: callerRow, error: callerError } = await supabaseAdmin
    .from('users')
    .select('uid, is_admin, email')
    .eq('uid', uid)
    .maybeSingle();
  if (!callerRow && email) {
    ({ data: callerRow, error: callerError } = await supabaseAdmin
      .from('users')
      .select('uid, is_admin, email')
      .eq('email', email)
      .maybeSingle());
  }
  if (callerError) return { ok: false, error: 'Failed to validate admin' };
  if (!callerRow?.is_admin) return { ok: false, error: 'Admin only' };
  return { ok: true };
};
