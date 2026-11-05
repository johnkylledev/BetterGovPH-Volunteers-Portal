// Discord roles are the membership signal for the community server: the portal decides who is a
// member, the worker (bot) applies the role. Every call is best effort — a Discord outage must never
// fail an approval, an erasure or a profile save, so callers get `false` instead of a throw.

const TIMEOUT_MS = 2500;

export type RoleKind = 'verified' | 'admin' | 'team';

const worker = () => {
  const base = (process.env.BETTYGO_BASE_URL || '').replace(/\/$/, '');
  const key = process.env.BETTYGO_API_KEY || '';
  return base && key ? { base, key } : null;
};

/** Role ids come from the environment so they can differ between staging and production. */
export const roleIdFor = (kind: RoleKind, projectId?: string): string => {
  if (kind === 'verified') return (process.env.DISCORD_ROLE_VERIFIED || '').trim();
  if (kind === 'admin') return (process.env.DISCORD_ROLE_ADMIN || '').trim();
  if (!projectId) return '';
  try {
    const map = JSON.parse(process.env.DISCORD_TEAM_ROLES || '{}');
    const role = map && typeof map === 'object' ? map[projectId] : '';
    return typeof role === 'string' ? role.trim() : '';
  } catch {
    return '';
  }
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

  if (verifiedRole) await (approved ? grantRole(discordId, verifiedRole) : revokeRole(discordId, verifiedRole));
  if (adminRole) await (row?.is_admin === true ? grantRole(discordId, adminRole) : revokeRole(discordId, adminRole));
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
