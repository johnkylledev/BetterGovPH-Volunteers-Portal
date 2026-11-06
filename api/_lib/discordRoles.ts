// Discord roles are the membership signal for the community server: the portal decides who is a
// member, the worker (bot) applies the role. Every call is best effort — a Discord outage must never
// fail an approval, an erasure or a profile save, so callers get `false` instead of a throw.

const TIMEOUT_MS = 2500;

export type RoleKind = 'verified' | 'admin' | 'team' | 'skill';

const worker = () => {
  const base = (process.env.BETTYGO_BASE_URL || '').replace(/\/$/, '');
  const key = process.env.BETTYGO_API_KEY || '';
  return base && key ? { base, key } : null;
};

/** Role ids come from the environment so they can differ between staging and production. */
type RoleMap = Record<string, string>;

const parseMap = (raw: string | undefined): RoleMap => {
  try {
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: RoleMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) out[key.trim().toLowerCase()] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
};

const skillRoleMap = (): RoleMap => parseMap(process.env.DISCORD_SKILL_ROLES);

export const roleIdFor = (kind: RoleKind, key?: string): string => {
  if (kind === 'verified') return (process.env.DISCORD_ROLE_VERIFIED || '').trim();
  if (kind === 'admin') return (process.env.DISCORD_ROLE_ADMIN || '').trim();
  if (kind === 'skill') {
    const name = String(key || '').trim().toLowerCase();
    return name ? skillRoleMap()[name] || '' : '';
  }
  if (!key) return '';
  return parseMap(process.env.DISCORD_TEAM_ROLES)[String(key).trim().toLowerCase()] || '';
};

/** Every role id the skill map owns — the only ones the sync is allowed to take away. */
const managedSkillRoles = (): Set<string> => new Set(Object.values(skillRoleMap()));

/** Skills arrive as `[{ name }]`, `[string]`, or a JSON string depending on the caller. */
const skillNames = (skills: unknown): string[] => {
  let list: unknown = skills;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { return []; }
  }
  if (!Array.isArray(list)) return [];
  const names = list
    .map((s) => (typeof s === 'string' ? s : s && typeof s === 'object' && 'name' in s ? (s as { name?: unknown }).name : ''))
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim().toLowerCase());
  return Array.from(new Set(names));
};
export const discordRolesEnabled = (): boolean => Boolean(worker() && (roleIdFor('verified') || roleIdFor('admin')));

const call = async (discordId: string, method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<boolean> => {
  const cfg = worker();
  if (!cfg || !discordId) return false;
  try {
    const res = await fetch(`${cfg.base}${path}`, {
      method,
      headers: { 'X-Api-Key': cfg.key, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error('[discord-roles] call failed', method, path, res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[discord-roles] call errored', method, path, err instanceof Error ? err.message : err);
    return false;
  }
};

export const grantRole = (discordId: string, roleId: string): Promise<boolean> =>
  roleId ? call(discordId, 'POST', `/users/${discordId}/discord/roles`, { roleId }) : Promise.resolve(false);

export const revokeRole = (discordId: string, roleId: string): Promise<boolean> =>
  roleId ? call(discordId, 'DELETE', `/users/${discordId}/discord/roles/${roleId}`) : Promise.resolve(false);

/**
 * Applies the role set a member should hold, given a row from `users`.
 * `verified` follows the account status, `admin` the admin flag; team roles are handled separately.
 */
export const syncMemberRoles = async (row: { discord_id?: unknown; status?: unknown; is_admin?: unknown }): Promise<void> => {
  const discordId = typeof row?.discord_id === 'string' ? row.discord_id.trim() : '';
  if (!discordId) return;

  const approved = String(row?.status || '').toLowerCase() === 'approved';
  const verifiedRole = roleIdFor('verified');
  const adminRole = roleIdFor('admin');

  // Side by side, so a slow worker costs one timeout, not two.
  await Promise.all([
    verifiedRole ? (approved ? grantRole(discordId, verifiedRole) : revokeRole(discordId, verifiedRole)) : null,
    adminRole ? (row?.is_admin === true ? grantRole(discordId, adminRole) : revokeRole(discordId, adminRole)) : null,
  ]);
};

/** Team membership is independent of approval: grant while the member is on the team, revoke when they leave. */
export const syncTeamRole = async (
  row: { discord_id?: unknown },
  projectId: string,
  member: boolean,
): Promise<void> => {
  const discordId = typeof row?.discord_id === 'string' ? row.discord_id.trim() : '';
  const roleId = roleIdFor('team', String(projectId));
  if (!discordId || !roleId) return;
  await (member ? grantRole(discordId, roleId) : revokeRole(discordId, roleId));
};

/** The roles a member currently holds in the guild, from the worker. Null when it could not be read. */
export const currentRoles = async (discordId: string): Promise<string[] | null> => {
  const cfg = worker();
  if (!cfg || !discordId) return null;
  try {
    const res = await fetch(`${cfg.base}/users/${discordId}/discord`, {
      headers: { 'X-Api-Key': cfg.key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error('[discord-roles] role read failed', res.status);
      return null;
    }
    const body = (await res.json()) as { roles?: unknown; verified?: unknown };
    if (!body || body.verified !== true) return [];
    return Array.isArray(body.roles) ? body.roles.filter((r): r is string => typeof r === 'string') : [];
  } catch (err) {
    console.error('[discord-roles] role read errored', err instanceof Error ? err.message : err);
    return null;
  }
};

/**
 * Skill roles follow the profile: mapped skills are granted, mapped roles the member no longer
 * qualifies for are taken away. Roles outside the map are never touched, and a failed membership
 * read aborts the whole pass so a Discord hiccup cannot strip anyone.
 */
export const syncSkillRoles = async (row: { discord_id?: unknown; skills?: unknown }): Promise<void> => {
  const map = skillRoleMap();
  const managed = managedSkillRoles();
  const discordId = typeof row?.discord_id === 'string' ? row.discord_id.trim() : '';
  if (!discordId || managed.size === 0) return;

  const desired = new Set<string>();
  for (const name of skillNames(row?.skills)) {
    const roleId = map[name];
    if (roleId) desired.add(roleId);
  }

  const current = await currentRoles(discordId);
  if (current === null) return;

  const managedCurrent = new Set(current.filter((roleId) => managed.has(roleId)));
  const toAdd = Array.from(desired).filter((roleId) => !managedCurrent.has(roleId));
  const toRemove = Array.from(managedCurrent).filter((roleId) => !desired.has(roleId));
  if (toAdd.length === 0 && toRemove.length === 0) return;

  await Promise.allSettled([
    ...toAdd.map((roleId) => grantRole(discordId, roleId)),
    ...toRemove.map((roleId) => revokeRole(discordId, roleId)),
  ]);
};
