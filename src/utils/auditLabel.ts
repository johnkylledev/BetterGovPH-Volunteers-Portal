/**
 * Turns a stored audit action into something an admin (or an auditor) can read.
 * The log records machine codes like `member.status`; this is the only place that
 * decides how each one is worded, so the wording stays consistent wherever it's shown.
 */

export interface AuditEntryLike {
  action: string;
  targetType?: string | null;
  details?: Record<string, unknown> | null;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' ? v : null);

const TARGET_WORD: Record<string, string> = {
  user: 'a member',
  call: 'a volunteer call',
  project: 'a project',
  role: 'a role',
};

export const auditLabel = (e: AuditEntryLike): string => {
  const d = e.details ?? {};
  const target = TARGET_WORD[String(e.targetType ?? '')] ?? '';

  switch (e.action) {
    case 'member.status': {
      const status = str(d.status).toLowerCase();
      if (status === 'approved') return 'Approved a member';
      if (status === 'declined') return 'Declined an application';
      return status ? `Set a member to ${status}` : 'Updated a member’s status';
    }
    case 'member.admin_rights':
      return d.isAdmin === true ? 'Made someone a super admin' : 'Removed someone’s admin rights';
    case 'member.role_assigned':
      return str(d.role) ? `Gave someone the ${str(d.role)} role` : 'Gave someone an admin role';
    case 'member.role_removed':
      return 'Removed someone’s admin role';
    case 'member.erase':
      return 'Erased a member’s data (deletion request)';
    case 'privacy.export':
      return num(d.members) !== null ? `Exported privacy records (${num(d.members)} members)` : 'Exported privacy records';
    case 'project.approve':
      return 'Approved a project';
    case 'project.send_back':
      return 'Sent a project back for changes';
    case 'project.edit':
      return 'Edited a project';
    case 'project.delete':
      return 'Deleted a project';
    case 'project.delete_with_user':
      return 'Deleted a project and its submitter';
    case 'projects.import':
      return num(d.imported) !== null ? `Imported ${num(d.imported)} projects` : 'Imported projects';
    case 'report.resolve': {
      const what = TARGET_WORD[String(e.targetType ?? '')] ?? 'a report';
      return d.hide === true ? `Resolved a report and hid ${what}` : `Resolved a report on ${what}`;
    }
    case 'role.created':
      return str(d.name) ? `Created the ${str(d.name)} role` : 'Created a role';
    case 'role.updated':
      return str(d.name) ? `Changed the ${str(d.name)} role` : 'Changed a role';
    case 'role.deleted':
      return str(d.name) ? `Deleted the ${str(d.name)} role` : 'Deleted a role';
    default: {
      // An action added later still reads sensibly rather than as a raw code.
      const words = e.action.replace(/[._]/g, ' ').trim();
      const sentence = words.charAt(0).toUpperCase() + words.slice(1);
      return target ? `${sentence} (${target})` : sentence;
    }
  }
};

/** A short note under the label when the entry carries something worth seeing. */
export const auditDetail = (e: AuditEntryLike): string => {
  const d = e.details ?? {};
  if (str(d.note)) return `“${str(d.note)}”`;
  if (Array.isArray(d.removed) && d.removed.length) return `Removed: ${d.removed.join(', ')}`;
  if (Array.isArray(d.fields) && d.fields.length) return `Changed: ${d.fields.join(', ')}`;
  if (Array.isArray(d.permissions) && d.permissions.length) return `${d.permissions.length} permissions`;
  return '';
};
