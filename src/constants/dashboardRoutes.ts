/**
 * Every dashboard tab has its own URL, so a refresh, the back button and shared links all land
 * on the same tab. Tab ids stay as they were internally; only the URL is new.
 *
 *   /dashboard            Overview          /admin               Overview
 *   /dashboard/projects   Projects          /admin/applications  Applications
 *   /dashboard/calls      Volunteer calls   /admin/members       Members
 *   /dashboard/merch      Merch             /admin/projects      Projects
 *                                           /admin/calls         Calls
 *                                           /admin/roles         Roles (super admins)
 *
 * Old links (?tab=volunteer, navigate state { tab }) still work: they redirect to the new URL.
 */

export type MemberTab = 'dashboard' | 'submit-project' | 'volunteer' | 'merch';
export type AdminTab = 'overview' | 'applications' | 'members' | 'projects' | 'calls' | 'roles';

const MEMBER_SEGMENT: Record<MemberTab, string> = {
  dashboard: '',
  'submit-project': 'projects',
  volunteer: 'calls',
  merch: 'merch',
};
const ADMIN_TABS: AdminTab[] = ['overview', 'applications', 'members', 'projects', 'calls', 'roles'];

export const memberTabPath = (tab: MemberTab) => (MEMBER_SEGMENT[tab] ? `/dashboard/${MEMBER_SEGMENT[tab]}` : '/dashboard');

/** The tab a /dashboard/:section URL means; null for an unknown section. */
export const memberTabFromSection = (section: string | undefined): MemberTab | null => {
  if (!section) return 'dashboard';
  const hit = (Object.keys(MEMBER_SEGMENT) as MemberTab[]).find((t) => MEMBER_SEGMENT[t] === section);
  return hit ?? null;
};

/** Legacy ids from ?tab= or navigate state: accepts both the old ids and the new segments. */
export const memberTabFromLegacy = (value: string | null | undefined): MemberTab | null => {
  if (!value) return null;
  if (value in MEMBER_SEGMENT) return value as MemberTab;
  return memberTabFromSection(value);
};

export const adminTabPath = (tab: AdminTab) => (tab === 'overview' ? '/admin' : `/admin/${tab}`);

export const adminTabFromSection = (section: string | undefined): AdminTab | null => {
  if (!section) return 'overview';
  return (ADMIN_TABS as string[]).includes(section) && section !== 'overview' ? (section as AdminTab) : null;
};
