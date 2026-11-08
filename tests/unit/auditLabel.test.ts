import { describe, expect, it } from 'vitest';
import { auditDetail, auditLabel } from '../../src/utils/auditLabel';

describe('audit log wording', () => {
  it('says what actually happened, not the action code', () => {
    expect(auditLabel({ action: 'member.status', targetType: 'user', details: { status: 'Approved' } })).toBe('Approved a member');
    expect(auditLabel({ action: 'member.status', targetType: 'user', details: { status: 'Declined' } })).toBe('Declined an application');
    expect(auditLabel({ action: 'report.resolve', targetType: 'call', details: { hide: true } })).toBe('Resolved a report and hid a volunteer call');
    expect(auditLabel({ action: 'report.resolve', targetType: 'call', details: {} })).toBe('Resolved a report on a volunteer call');
    expect(auditLabel({ action: 'privacy.export', details: { members: 16 } })).toBe('Exported privacy records (16 members)');
    expect(auditLabel({ action: 'projects.import', details: { imported: 18 } })).toBe('Imported 18 projects');
    expect(auditLabel({ action: 'role.created', targetType: 'role', details: { name: 'Legal' } })).toBe('Created the Legal role');
    expect(auditLabel({ action: 'member.role_assigned', targetType: 'user', details: { role: 'Legal' } })).toBe('Gave someone the Legal role');
    expect(auditLabel({ action: 'member.admin_rights', details: { isAdmin: true } })).toBe('Made someone a super admin');
    expect(auditLabel({ action: 'member.erase', targetType: 'user' })).toBe('Erased a member’s data (deletion request)');
  });

  it('still reads sensibly for an action added later', () => {
    expect(auditLabel({ action: 'widget.frobbed', targetType: 'user' })).toBe('Widget frobbed (a member)');
    expect(auditLabel({ action: 'something.new' })).toBe('Something new');
  });

  it('never leaves a bare code or an empty label', () => {
    for (const action of ['member.status', 'project.approve', 'role.updated', 'unknown.thing']) {
      const label = auditLabel({ action, details: {} });
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toContain('_');
      expect(label).not.toMatch(/^[a-z]+\.[a-z]/);
    }
  });

  it('surfaces the note or the changed fields underneath', () => {
    expect(auditDetail({ action: 'project.send_back', details: { note: 'Add a README' } })).toBe('“Add a README”');
    expect(auditDetail({ action: 'project.edit', details: { fields: ['title', 'url'] } })).toBe('Changed: title, url');
    expect(auditDetail({ action: 'member.status', details: {} })).toBe('');
  });
});
