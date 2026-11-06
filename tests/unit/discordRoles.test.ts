import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  roleIdFor, grantRole, revokeRole, syncMemberRoles, syncSkillRoles, syncTeamRole, discordRolesEnabled,
} from '../../api/_lib/discordRoles';

const calls: { url: string; init: RequestInit }[] = [];
let reply: { ok: boolean; status: number } = { ok: true, status: 200 };

beforeEach(() => {
  calls.length = 0;
  reply = { ok: true, status: 200 };
  process.env.BETTYGO_BASE_URL = 'https://bettygo.test/';
  process.env.BETTYGO_API_KEY = 'worker-key';
  process.env.DISCORD_ROLE_VERIFIED = '111111111111111111';
  process.env.DISCORD_ROLE_ADMIN = '222222222222222222';
  process.env.DISCORD_TEAM_ROLES = JSON.stringify({ '42': '333333333333333333' });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: reply.status });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BETTYGO_BASE_URL;
  delete process.env.BETTYGO_API_KEY;
  delete process.env.DISCORD_ROLE_VERIFIED;
  delete process.env.DISCORD_ROLE_ADMIN;
  delete process.env.DISCORD_TEAM_ROLES;
});

describe('role configuration', () => {
  it('reads role ids from the environment', () => {
    expect(roleIdFor('verified')).toBe('111111111111111111');
    expect(roleIdFor('admin')).toBe('222222222222222222');
    expect(roleIdFor('team', '42')).toBe('333333333333333333');
    expect(roleIdFor('team', 'unknown')).toBe('');
  });

  it('survives a malformed team map', () => {
    process.env.DISCORD_TEAM_ROLES = '{not json';
    expect(roleIdFor('team', '42')).toBe('');
  });

  it('is disabled without a worker or role ids', () => {
    delete process.env.BETTYGO_BASE_URL;
    expect(discordRolesEnabled()).toBe(false);
    process.env.BETTYGO_BASE_URL = 'https://bettygo.test';
    delete process.env.DISCORD_ROLE_VERIFIED;
    delete process.env.DISCORD_ROLE_ADMIN;
    expect(discordRolesEnabled()).toBe(false);
  });
});

describe('role calls', () => {
  it('grants a role through the worker', async () => {
    await expect(grantRole('123456789012345678', '111111111111111111')).resolves.toBe(true);
    expect(calls[0].url).toBe('https://bettygo.test/users/123456789012345678/discord/roles');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['X-Api-Key']).toBe('worker-key');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ roleId: '111111111111111111' });
  });

  it('revokes a role with DELETE', async () => {
    await expect(revokeRole('123456789012345678', '222222222222222222')).resolves.toBe(true);
    expect(calls[0].url).toBe('https://bettygo.test/users/123456789012345678/discord/roles/222222222222222222');
    expect(calls[0].init.method).toBe('DELETE');
  });

  it('fails soft when the worker answers with an error', async () => {
    reply = { ok: false, status: 500 };
    await expect(syncMemberRoles({ discord_id: '123456789012345678', status: 'Approved' })).resolves.toBeUndefined();
  });

  it('does nothing without a Discord id', async () => {
    await syncMemberRoles({ discord_id: '', status: 'Approved' });
    expect(calls).toHaveLength(0);
  });
});

describe('syncMemberRoles', () => {
  it('grants the verified role for an approved member', async () => {
    await syncMemberRoles({ discord_id: '123456789012345678', status: 'approved', is_admin: false });
    expect(calls.map((c) => `${c.init.method} ${c.url.split('/discord/')[1]}`)).toEqual([
      'POST roles',
      'DELETE roles/222222222222222222',
    ]);
  });

  it('revokes both roles for a declined member', async () => {
    await syncMemberRoles({ discord_id: '123456789012345678', status: 'Declined', is_admin: false });
    expect(calls.map((c) => c.init.method)).toEqual(['DELETE', 'DELETE']);
  });

  it('grants the admin role when the flag is on', async () => {
    await syncMemberRoles({ discord_id: '123456789012345678', status: 'Approved', is_admin: true });
    const adminGrant = calls.find((c) => c.init.method === 'POST' && JSON.parse(String(c.init.body)).roleId === '222222222222222222');
    expect(adminGrant).toBeTruthy();
  });
});

describe('syncTeamRole', () => {
  it('grants and revokes a project role', async () => {
    await syncTeamRole({ discord_id: '123456789012345678' }, '42', true);
    await syncTeamRole({ discord_id: '123456789012345678' }, '42', false);
    expect(calls.map((c) => c.init.method)).toEqual(['POST', 'DELETE']);
    expect(calls[0].url.endsWith('/discord/roles')).toBe(true);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ roleId: '333333333333333333' });
    expect(calls[1].url.endsWith('/roles/333333333333333333')).toBe(true);
  });

  it('skips projects without a mapped role', async () => {
    await syncTeamRole({ discord_id: '123456789012345678' }, '99', true);
    expect(calls).toHaveLength(0);
  });
});

describe('skill roles', () => {
  const setSkills = (map: Record<string, string>) => {
    process.env.DISCORD_SKILL_ROLES = JSON.stringify(map);
  };

  afterEach(() => { delete process.env.DISCORD_SKILL_ROLES; });

  it('maps skill names case-insensitively', () => {
    setSkills({ React: '555555555555555555', 'figma ': '666666666666666666' });
    expect(roleIdFor('skill', 'react')).toBe('555555555555555555');
    expect(roleIdFor('skill', 'FIGMA')).toBe('666666666666666666');
    expect(roleIdFor('skill', 'cobol')).toBe('');
  });

  it('grants only the new skills and ignores unmapped ones', async () => {
    setSkills({ React: '555555555555555555', Figma: '666666666666666666' });
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/discord') && (init.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify({ verified: true, roles: ['666666666666666666', '777777777777777777'] }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(null, { status: 200 });
    });

    await syncSkillRoles({ discord_id: '123456789012345678', status: 'Approved', skills: [{ name: 'React' }, { name: 'Cobol' }] });

    const writes = calls.filter((c) => c.url.includes('/discord/roles'));
    const summary = writes.map((c) => {
      const body = typeof c.init.body === 'string' ? JSON.parse(c.init.body) : null;
      return `${c.init.method} ${body?.roleId ?? c.url.split('/').pop()}`;
    });
    expect(summary).toEqual(['POST 555555555555555555', 'DELETE 666666666666666666']);
  });

  it('never touches roles outside the skill map', async () => {
    setSkills({ React: '555555555555555555' });
    calls.length = 0;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/discord') && (init.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify({ verified: true, roles: ['999999999999999999'] }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(null, { status: 200 });
    });

    await syncSkillRoles({ discord_id: '123456789012345678', status: 'Approved', skills: [{ name: 'React' }] });
    const writes = calls.filter((c) => c.url.includes('/discord/roles'));
    // React is granted; the unrelated role 999 is not removed because the map does not own it.
    expect(writes.map((c) => `${c.init.method} ${c.url.split('/').pop()}`)).toEqual(['POST roles']);
  });

  it('does nothing when the membership read fails', async () => {
    setSkills({ React: '555555555555555555' });
    calls.length = 0;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ error: 'guild_check_failed' }), { status: 502 });
    });

    await syncSkillRoles({ discord_id: '123456789012345678', status: 'Approved', skills: [{ name: 'React' }] });
    // The failed read aborts the pass: no grant, no revoke.
    expect(calls.filter((c) => c.url.includes('/discord/roles'))).toHaveLength(0);
  });

  const holding = (roles: string[]) => vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/discord') && (init.method ?? 'GET') === 'GET') {
      return new Response(JSON.stringify({ verified: true, roles }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(null, { status: 200 });
  });
  const writesOf = () => calls.filter((c) => c.url.includes('/discord/roles')).map((c) => {
    const body = typeof c.init.body === 'string' ? JSON.parse(c.init.body) : null;
    return `${c.init.method} ${body?.roleId ?? c.url.split('/').pop()}`;
  });

  it('gives pending or declined members no skill roles, and takes away mapped ones they hold', async () => {
    setSkills({ React: '555555555555555555', Figma: '666666666666666666' });
    calls.length = 0;
    holding(['666666666666666666', '999999999999999999']);
    for (const status of ['Pending', 'Declined']) {
      calls.length = 0;
      await syncSkillRoles({ discord_id: '123456789012345678', status, skills: [{ name: 'React' }, { name: 'Figma' }] });
      // No grant for React; the held Figma role goes; the unrelated 999 role stays.
      expect(writesOf()).toEqual(['DELETE 666666666666666666']);
    }
  });

  it('removes every mapped skill role when an account is erased', async () => {
    setSkills({ React: '555555555555555555', Figma: '666666666666666666' });
    calls.length = 0;
    holding(['555555555555555555', '666666666666666666', '999999999999999999']);
    await syncSkillRoles({ discord_id: '123456789012345678', status: 'deleted', skills: [] });
    expect(writesOf().sort()).toEqual(['DELETE 555555555555555555', 'DELETE 666666666666666666']);
  });

  it('skips members who have not linked Discord', async () => {
    setSkills({ React: '555555555555555555' });
    calls.length = 0;
    await syncSkillRoles({ discord_id: null, skills: [{ name: 'React' }] });
    expect(calls).toHaveLength(0);
  });
});
