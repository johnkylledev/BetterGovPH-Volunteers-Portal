export const generateUniqueMemberId = async (client: any, selectedYear: number) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await client
      .from('users')
      .select('member_id')
      .ilike('member_id', `BGPH-${selectedYear}-%`)
      .order('member_id', { ascending: false })
      .limit(100);

    if (error) throw error;

    let maxSequence = 0;
    for (const u of data ?? []) {
      const memberId = u.member_id;
      if (typeof memberId !== 'string') continue;
      const match = memberId.match(/^BGPH-(\d{4})-(\d{3})$/);
      if (match && parseInt(match[1]) === selectedYear) {
        const seq = parseInt(match[2], 10);
        if (!isNaN(seq) && seq > maxSequence) maxSequence = seq;
      }
    }

    const nextSequence = maxSequence + 1;
    const newMemberId = `BGPH-${selectedYear}-${String(nextSequence).padStart(3, '0')}`;

    const { data: checkDuplicate } = await client
      .from('users')
      .select('member_id')
      .eq('member_id', newMemberId)
      .maybeSingle();

    if (!checkDuplicate) {
      return newMemberId;
    }
  }

  throw new Error('Failed to generate unique member ID after 5 attempts');
};

export const ensureUserHasMemberId = async (client: any, uid: string) => {
  const { data, error } = await client
    .from('users')
    .select('member_id, year_joined')
    .eq('uid', uid)
    .maybeSingle();

  if (error) throw error;
  if (data?.member_id) return data.member_id as string;

  const yearJoined = data?.year_joined || new Date().getFullYear();
  const memberId = await generateUniqueMemberId(client, yearJoined);
  await client
    .from('users')
    .update({ member_id: memberId, updated_at: new Date().toISOString() })
    .eq('uid', uid);

  return memberId;
};
