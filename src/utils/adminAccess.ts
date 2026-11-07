import type { User } from '../types';

/**
 * Admin permissions. The server enforces these on every request (api/[...path].ts, adminAccessOf);
 * the app only uses them to show the tabs and buttons a person can actually use.
 * Keep this list in step with ADMIN_PERMISSIONS on the server and the admin_roles check constraint.
 */
export const ADMIN_PERMISSIONS = [
  { id: 'members.view', label: 'View members', hint: 'Applications and the member list, including emails' },
  { id: 'members.decide', label: 'Decide applications', hint: 'Approve or decline members and issue member IDs' },
  { id: 'projects.review', label: 'Review projects', hint: 'Approve, send back or delete project submissions' },
  { id: 'projects.import', label: 'Import projects', hint: 'Bulk import from the Discord project list' },
  { id: 'calls.moderate', label: 'Moderate calls', hint: 'Close, hide or remove volunteer calls' },
  { id: 'reports.handle', label: 'Handle reports', hint: 'The reports queue: dismiss or act on reports' },
  { id: 'privacy.records', label: 'Privacy records', hint: 'Consent records and the ROPA export (Data Privacy Act)' },
  { id: 'privacy.erase', label: 'Erase accounts', hint: 'Deletion requests and erasing a member’s data' },
  { id: 'audit.view', label: 'View audit log', hint: 'Who did what in the admin panel' },
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]['id'] | 'roles.manage';

/** Ready-made starting points when creating a role; super admins can change every box. */
export const ROLE_PRESETS: { name: string; description: string; permissions: AdminPermission[] }[] = [
  { name: 'Legal', description: 'Data privacy requests, consent records, reports and the audit trail.', permissions: ['members.view', 'privacy.records', 'privacy.erase', 'reports.handle', 'audit.view'] },
  { name: 'Reviewer', description: 'Reviews member applications and project submissions.', permissions: ['members.view', 'members.decide', 'projects.review'] },
  { name: 'Moderator', description: 'Keeps volunteer calls and reports clean.', permissions: ['calls.moderate', 'reports.handle'] },
];

export const isSuperAdmin = (u: User | null | undefined) => !!u?.isAdmin;

/** Super admins, or anyone holding a role with at least one permission. */
export const hasAdminAccess = (u: User | null | undefined) => !!u && (!!u.isAdmin || (u.adminPermissions?.length ?? 0) > 0);

export const can = (u: User | null | undefined, p: AdminPermission) =>
  !!u && (!!u.isAdmin || (u.adminPermissions ?? []).includes(p));
