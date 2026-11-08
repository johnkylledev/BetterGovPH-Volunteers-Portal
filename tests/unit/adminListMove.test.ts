import { describe, expect, it } from 'vitest';
import type { User } from '../../src/types';

/**
 * The rule the admin list follows when a decision is made: the row leaves the lists it no longer
 * matches and joins the ones it now does. This mirrors applyRowChange in useAdminMembers, so the
 * behaviour is pinned even though the hook itself needs a React tree to run.
 */
const keyOf = (f: { status?: string; role?: string; search?: string }) =>
  `${f.status ?? 'All'}|${f.role ?? 'All'}|${(f.search ?? '').trim().toLowerCase()}`;

const matches = (row: User, key: string) => {
  const [status, role, search] = key.split('|');
  const text = `${row.fullName ?? ''} ${row.email ?? ''} ${row.discordUsername ?? ''} ${row.memberId ?? ''}`.toLowerCase();
  return (
    (status === 'All' || String(row.status ?? '').toLowerCase() === status.toLowerCase()) &&
    (role === 'All' || String(row.specialization ?? '') === role) &&
    (!search || text.includes(search))
  );
};

const applicant = (over: Partial<User> = {}): User => ({
  id: 'u1', uid: 'u1', fullName: 'Maria Cecilia Pilotin', email: 'maria@example.com',
  specialization: 'Lawyer & Policy Expert', role: 'Member', status: 'Pending', isAdmin: false, ...over,
} as User);

describe('where a decided row belongs', () => {
  const applications = keyOf({ status: 'Pending' });
  const members = keyOf({ status: 'Approved' });

  it('an approved applicant leaves Applications and joins Members', () => {
    const before = applicant();
    expect(matches(before, applications)).toBe(true);
    expect(matches(before, members)).toBe(false);

    const after = { ...before, status: 'Approved' as const, memberId: 'BGPH-2026-007' };
    expect(matches(after, applications)).toBe(false); // removed from the list being viewed
    expect(matches(after, members)).toBe(true); // already there when the admin switches tabs
  });

  it('a declined applicant leaves both lists', () => {
    const after = { ...applicant(), status: 'Declined' as const };
    expect(matches(after, applications)).toBe(false);
    expect(matches(after, members)).toBe(false);
  });

  it('status matching ignores case, as the server’s variants do', () => {
    expect(matches(applicant({ status: 'approved' as never }), members)).toBe(true);
    expect(matches(applicant({ status: 'APPROVED' as never }), members)).toBe(true);
  });

  it('a role-filtered list only keeps the row while the role still matches', () => {
    const lawyers = keyOf({ status: 'Approved', role: 'Lawyer & Policy Expert' });
    const approved = applicant({ status: 'Approved' as never });
    expect(matches(approved, lawyers)).toBe(true);
    expect(matches({ ...approved, specialization: 'Frontend Developer' }, lawyers)).toBe(false);
  });

  it('a searched list keeps the row only while it still matches the search', () => {
    const searched = keyOf({ status: 'Approved', search: 'maria' });
    const approved = applicant({ status: 'Approved' as never });
    expect(matches(approved, searched)).toBe(true);
    expect(matches({ ...approved, fullName: 'Renan Catahay', email: 'renan@example.com' }, searched)).toBe(false);
  });

  it('a new member ID makes the row findable by it straight away', () => {
    const byId = keyOf({ status: 'Approved', search: 'bgph-2026-007' });
    const approved = applicant({ status: 'Approved' as never, memberId: 'BGPH-2026-007' });
    expect(matches(approved, byId)).toBe(true);
  });
});
