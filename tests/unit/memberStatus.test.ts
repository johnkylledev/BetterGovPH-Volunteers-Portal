import { describe, it, expect } from 'vitest';

/*
 * Section 9 of the terms ("Termination of participation") makes promises that live in code:
 * a suspension says why, it is reversible, and it withdraws what approval granted. These check
 * the rules that enforce them, apart from the request handler.
 */

const MEMBER_STATUSES = ['Pending', 'Approved', 'Declined', 'Suspended'] as const;
type MemberStatus = (typeof MEMBER_STATUSES)[number];

/** Mirrors the handler: an unknown status is refused rather than written to the column. */
const statusAccepted = (status: string) => MEMBER_STATUSES.includes(status as MemberStatus);

/** Mirrors the handler: a suspension cannot be saved without a reason for the member. */
const suspensionAllowed = (status: string, note: string | undefined) =>
  status !== 'Suspended' || !!String(note ?? '').trim();

/** What every member-only endpoint actually asks before letting someone act. */
const mayActAsMember = (status: string) => String(status ?? '').toLowerCase() === 'approved';

/** Mirrors /me: the identity on the record is locked once there is a card to vouch for it. */
const identityLocked = (status: string) => ['approved', 'suspended'].includes(String(status ?? '').toLowerCase());

const statusVariantsOf = (filter: string): string[] =>
  Array.from(new Set(filter.split(',').map((one) => one.trim()).filter(Boolean).flatMap((one) => [
    one, one.toLowerCase(), one.toUpperCase(), one.charAt(0).toUpperCase() + one.slice(1).toLowerCase(),
  ])));

describe('the status column', () => {
  it('takes only the four statuses the app understands', () => {
    for (const s of MEMBER_STATUSES) expect(statusAccepted(s)).toBe(true);
  });

  // Before the allow-list, any string went into the column. Every permission check keys on
  // 'Approved', so a typo like "Suspeded" would lock someone out with no way back through the UI.
  it('refuses anything else, including near-misses', () => {
    for (const s of ['Suspeded', 'suspend', 'banned', 'Admin', '', 'DROP TABLE users']) {
      expect(statusAccepted(s), s).toBe(false);
    }
  });
});

describe('suspending someone', () => {
  it('needs a reason, because the member is shown it', () => {
    expect(suspensionAllowed('Suspended', undefined)).toBe(false);
    expect(suspensionAllowed('Suspended', '   ')).toBe(false);
    expect(suspensionAllowed('Suspended', 'Posted a client’s data in #general.')).toBe(true);
  });

  it('does not burden the other decisions with one', () => {
    expect(suspensionAllowed('Approved', undefined)).toBe(true);
    expect(suspensionAllowed('Declined', undefined)).toBe(true);
  });

  it('withdraws everything approval granted', () => {
    expect(mayActAsMember('Approved')).toBe(true);
    expect(mayActAsMember('Suspended')).toBe(false);
    expect(mayActAsMember('Pending')).toBe(false);
  });

  // The record survives, so reinstating is one decision rather than a re-application.
  it('leaves the identity on the record locked', () => {
    expect(identityLocked('Suspended')).toBe(true);
    expect(identityLocked('Approved')).toBe(true);
    expect(identityLocked('Pending')).toBe(false);
  });
});

describe('finding a suspended member again', () => {
  // Filtered to 'Approved' alone, a suspended member would vanish from the admin tables and there
  // would be no way to reinstate them.
  it('matches approved and suspended together, in any spelling', () => {
    const variants = statusVariantsOf('Approved,Suspended');
    expect(variants).toContain('Approved');
    expect(variants).toContain('approved');
    expect(variants).toContain('Suspended');
    expect(variants).toContain('SUSPENDED');
  });

  it('still handles a single status', () => {
    expect(statusVariantsOf('Pending')).toEqual(['Pending', 'pending', 'PENDING']);
  });
});
