import { describe, expect, it } from 'vitest';
import {
  adminTabFromSection, adminTabPath, memberTabFromLegacy, memberTabFromSection, memberTabPath,
} from '../../src/constants/dashboardRoutes';

describe('member dashboard URLs', () => {
  it('maps every tab to its own path and back', () => {
    for (const [tab, path] of [['dashboard', '/dashboard'], ['submit-project', '/dashboard/projects'], ['volunteer', '/dashboard/calls'], ['merch', '/dashboard/merch']] as const) {
      expect(memberTabPath(tab)).toBe(path);
      expect(memberTabFromSection(path.split('/')[2])).toBe(tab);
    }
  });
  it('treats an unknown section as unknown, not as a tab', () => {
    expect(memberTabFromSection('nope')).toBeNull();
    expect(memberTabFromSection('submit-project')).toBeNull(); // old id is not a URL segment
  });
  it('understands old ?tab= ids and new segments', () => {
    expect(memberTabFromLegacy('volunteer')).toBe('volunteer');
    expect(memberTabFromLegacy('submit-project')).toBe('submit-project');
    expect(memberTabFromLegacy('calls')).toBe('volunteer');
    expect(memberTabFromLegacy('nope')).toBeNull();
    expect(memberTabFromLegacy(null)).toBeNull();
  });
});

describe('admin dashboard URLs', () => {
  it('maps every tab to its own path and back', () => {
    expect(adminTabPath('overview')).toBe('/admin');
    for (const tab of ['applications', 'members', 'projects', 'calls'] as const) {
      expect(adminTabPath(tab)).toBe(`/admin/${tab}`);
      expect(adminTabFromSection(tab)).toBe(tab);
    }
    expect(adminTabFromSection(undefined)).toBe('overview');
  });
  it('rejects unknown sections and a redundant /admin/overview', () => {
    expect(adminTabFromSection('nope')).toBeNull();
    expect(adminTabFromSection('overview')).toBeNull();
  });
});
