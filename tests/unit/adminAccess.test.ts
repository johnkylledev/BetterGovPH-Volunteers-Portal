import { describe, expect, it } from 'vitest';
import { ADMIN_PERMISSIONS, ROLE_PRESETS, can, hasAdminAccess, isSuperAdmin } from '../../src/utils/adminAccess';
import type { User } from '../../src/types';

const user = (over: Partial<User>): User => ({ id: 'u', uid: 'u', fullName: 'Test', email: 't@example.com', specialization: '', role: 'Member', status: 'Approved', isAdmin: false, ...over } as User);

describe('admin access (UI side)', () => {
  it('super admins can do everything', () => {
    const u = user({ isAdmin: true });
    expect(isSuperAdmin(u)).toBe(true);
    expect(hasAdminAccess(u)).toBe(true);
    for (const p of ADMIN_PERMISSIONS) expect(can(u, p.id)).toBe(true);
    expect(can(u, 'roles.manage')).toBe(true);
  });
  it('a role holder gets only the role’s permissions', () => {
    const u = user({ adminRoleName: 'Legal', adminPermissions: ['members.view', 'privacy.records'] });
    expect(hasAdminAccess(u)).toBe(true);
    expect(isSuperAdmin(u)).toBe(false);
    expect(can(u, 'privacy.records')).toBe(true);
    expect(can(u, 'members.decide')).toBe(false);
    expect(can(u, 'roles.manage')).toBe(false);
  });
  it('regular members and signed-out visitors have no admin access', () => {
    expect(hasAdminAccess(user({}))).toBe(false);
    expect(hasAdminAccess(user({ adminPermissions: [] }))).toBe(false);
    expect(hasAdminAccess(null)).toBe(false);
    expect(can(undefined, 'members.view')).toBe(false);
  });
  it('presets only use real permissions, and never role management', () => {
    const ids = new Set<string>(ADMIN_PERMISSIONS.map((p) => p.id));
    for (const p of ROLE_PRESETS) {
      expect(p.permissions.every((x) => ids.has(x))).toBe(true);
      expect(p.permissions).not.toContain('roles.manage');
    }
  });
});
