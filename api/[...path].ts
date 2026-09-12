import { createClient } from '@supabase/supabase-js';

let _crypto: any = null;
let _cryptoInit = false;

const tryLoadCrypto = (): any => {
  if (_cryptoInit) return _crypto;
  _cryptoInit = true;
  try {
    const req = (globalThis as any).require;
    if (typeof req === 'function') {
      const mod = req('node:crypto');
      if (mod && typeof mod.randomUUID === 'function') _crypto = mod;
    }
  } catch { _crypto = null; }
  return _crypto;
};

const safeRandomUuid = (): string => {
  try {
    const mod = tryLoadCrypto();
    if (mod && typeof mod.randomUUID === 'function') {
      const v = mod.randomUUID();
      if (typeof v === 'string' && v.length > 0) return v;
    }
  } catch { /* noop */ }
  const rnd = (n: number) => {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  };
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-a${rnd(3)}-${rnd(12)}`;
};

// ============================================================================
//  Shared helpers — supabase, http, validation, caching, scoring
// ============================================================================

const LIB_API_VERSION = '1.0.0';

const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
  return { url, anonKey, serviceKey };
};

const getBearerToken = (authorizationHeader: unknown): string | null => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const getBody = (req: any) => {
  let body = req.body ?? {};
  const isBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(body);
  if (isBuffer) {
    try { body = body.toString('utf-8'); } catch { body = {}; }
  }
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return body || {};
};

const getStringParam = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return null;
};

const getNumberParam = (value: unknown, fallback: number): number => {
  const s = getStringParam(value);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const createAnonClient = (url: string, anonKey: string) =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const createServiceClient = (url: string, serviceKey: string) =>
  createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const errorToString = (err: unknown): string => {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return String((err as any).message);
  }
  return 'Internal server error';
};

const sendJson = (res: any, statusCode: number, body: Record<string, unknown>) => {
  try {
    if (!res) return;
    if (res.headersSent || res.writableEnded) return;
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-API-Version', LIB_API_VERSION);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
    res.end(JSON.stringify(body));
  } catch {
    try {
      if (res && !res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Response write failed' }));
      } else if (res && !res.writableEnded) {
        res.end();
      }
    } catch {
      /* noop */
    }
  }
};

const sendError = (res: any, statusCode: number, message: string) =>
  sendJson(res, statusCode, { error: message });

const mapUserRow = (row: any) => ({
  id: row.uid,
  uid: row.uid,
  fullName: row.full_name ?? '',
  email: row.email ?? '',
  specialization: row.specialization ?? '',
  role: row.role ?? 'Member',
  discordUsername: row.discord_username ?? '',
  status: row.status ?? 'Pending',
  memberId: row.member_id ?? undefined,
  yearJoined: row.year_joined ?? undefined,
  skills: row.skills ?? [],
  experienceLevel: row.experience_level ?? undefined,
  adminNotes: row.admin_notes ?? undefined,
  isAdmin: !!row.is_admin,
  authProvider: row.auth_provider ?? 'traditional',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  discordId: row.discord_id ?? undefined,
  discordConnected: row.discord_connected ?? false,
  discordVerified: row.discord_verified ?? false,
  discordDisplayName: row.discord_display_name ?? undefined,
  discordAvatar: row.discord_avatar ?? undefined,
});

// ----- Redis / Upstash + memory cache (contrib of api/_lib/redis.ts) --------
interface MemoryCacheEntry { value: any; expiresAt: number; }
const memoryCache = new Map<string, MemoryCacheEntry>();
let gcScheduled = false;
const scheduleGc = () => {
  if (gcScheduled || typeof setInterval === 'undefined') return;
  gcScheduled = true;
  try {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of memoryCache.entries()) {
        if (now > entry.expiresAt) memoryCache.delete(key);
      }
    }, 60_000);
  } catch { gcScheduled = false; }
};

const getRedisConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL || process.env.VITE_UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN || process.env.VITE_UPSTASH_REDIS_REST_TOKEN || '';
  return { url, token };
};

async function upstashCommand<T = any>(command: any[]): Promise<T | null> {
  const { url, token } = getRedisConfig();
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.result ?? null) as T | null;
  } catch { return null; }
}

async function getCache<T = any>(key: string): Promise<T | null> {
  const { url, token } = getRedisConfig();
  if (url && token) {
    const result = await upstashCommand(['GET', key]);
    if (result !== null && result !== undefined) {
      try { return typeof result === 'string' ? JSON.parse(result) : (result as T); }
      catch { return result as unknown as T; }
    }
  }
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memoryCache.delete(key); return null; }
  return entry.value as T;
}

async function setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  const stringified = JSON.stringify(value);
  const { url, token } = getRedisConfig();
  scheduleGc();
  if (url && token) await upstashCommand(['SET', key, stringified, 'EX', ttlSeconds]);
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function invalidateCache(keyOrPrefix: string): Promise<void> {
  const { url, token } = getRedisConfig();
  if (url && token) {
    if (keyOrPrefix.endsWith('*')) {
      const keys = await upstashCommand<string[]>(['KEYS', keyOrPrefix]);
      if (Array.isArray(keys) && keys.length > 0) await upstashCommand(['DEL', ...keys]);
    } else {
      await upstashCommand(['DEL', keyOrPrefix]);
    }
  }
  if (keyOrPrefix.endsWith('*')) {
    const prefix = keyOrPrefix.slice(0, -1);
    for (const key of memoryCache.keys()) if (key.startsWith(prefix)) memoryCache.delete(key);
  } else {
    memoryCache.delete(keyOrPrefix);
  }
}

// ----- Contribution scoring (INLINE to avoid Vercel _lib folder exclusion) -----
interface ExternalProject {
  slug?: string; title?: string; id?: string; project_name?: string;
  project_url?: string; description?: string | null;
  repositoryUrls?: string[]; [k: string]: unknown;
}
interface GithubRepo { owner: string; name: string; }
interface ContributorStats {
  login: string; commits: number; prs: number; reviews: number;
  issues: number; repos: string[];
}
interface ContributorScore extends ContributorStats { score: number; }

async function fetchProjects(projectsUrl: string): Promise<ExternalProject[]> {
  const res = await fetch(projectsUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  const body = (await res.json()) as unknown;
  if (Array.isArray(body)) return body as ExternalProject[];
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (Array.isArray(b.projects)) return b.projects as ExternalProject[];
    if (Array.isArray(b.data)) return b.data as ExternalProject[];
  }
  throw new Error('Unexpected projects response shape');
}

const GH_RE = /github\.com\/([A-Za-z0-9_.\-~]+)\/([A-Za-z0-9_.\-~]+?)(?:\.git)?(?:[#?\/]|$)/i;

function extractRepos(projects: ExternalProject[]): GithubRepo[] {
  const seen = new Set<string>();
  const out: GithubRepo[] = [];
  const addStr = (s: string) => {
    const m = s.match(GH_RE);
    if (!m) return;
    const owner = m[1].toLowerCase();
    const name = m[2].toLowerCase();
    if (owner === 'sponsors' || owner === 'features' || owner === 'topics' || owner.length < 2 || name.length < 2) return;
    const k = `${owner}/${name}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ owner, name });
  };
  for (const p of projects) {
    if (Array.isArray(p.repositoryUrls)) for (const u of p.repositoryUrls) if (typeof u === 'string') addStr(u);
    for (const k of ['project_url', 'url', 'homepage', 'repo', 'repositoryUrl', 'html_url']) {
      const v = (p as Record<string, unknown>)[k];
      if (typeof v === 'string') addStr(v);
    }
    if (typeof p.description === 'string') addStr(p.description);
  }
  return out;
}

const GITHUB_API = 'https://api.github.com/graphql';
async function ghGql(token: string, query: string, variables?: Record<string, unknown>): Promise<any> {
  const res = await fetch(GITHUB_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'bettergovph-score/1.0',
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function fetchCommits(owner: string, repo: string, token: string): Promise<string[]> {
  const logins: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const q = `
      query {
        repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 100${cursor ? `, after: ${JSON.stringify(cursor)}` : ''}) {
                  nodes { author { user { login } } }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }
        }
      }`;
    const j = await ghGql(token, q);
    const h = j?.data?.repository?.defaultBranchRef?.target?.history;
    const nodes: any[] = h?.nodes ?? [];
    for (const n of nodes) { const l = n?.author?.user?.login; if (l) logins.push(String(l)); }
    if (!h?.pageInfo?.hasNextPage) break;
    cursor = h.pageInfo.endCursor ?? null;
    if (!cursor) break;
  }
  return logins;
}

async function fetchPrsAndReviews(owner: string, repo: string, token: string): Promise<{ prLogins: string[]; reviewLogins: string[] }> {
  const q = `
    query {
      repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
        pullRequests(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
          nodes {
            author { login }
            reviews(first: 30) { nodes { author { login } } }
          }
        }
      }
    }`;
  const j = await ghGql(token, q);
  const nodes: any[] = j?.data?.repository?.pullRequests?.nodes ?? [];
  const prLogins: string[] = [];
  const reviewLogins: string[] = [];
  for (const n of nodes) {
    const l = n?.author?.login; if (l) prLogins.push(String(l));
    const rns: any[] = n?.reviews?.nodes ?? [];
    for (const r of rns) { const rl = r?.author?.login; if (rl) reviewLogins.push(String(rl)); }
  }
  return { prLogins, reviewLogins };
}

async function fetchIssues(owner: string, repo: string, token: string): Promise<string[]> {
  const q = `
    query {
      repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
        issues(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
          nodes { author { login } }
        }
      }
    }`;
  const j = await ghGql(token, q);
  const nodes: any[] = j?.data?.repository?.issues?.nodes ?? [];
  const out: string[] = [];
  for (const n of nodes) { const l = n?.author?.login; if (l) out.push(String(l)); }
  return out;
}

async function fetchRepoContributions(repo: GithubRepo, token: string): Promise<Map<string, ContributorStats>> {
  const map = new Map<string, ContributorStats>();
  const upsert = (login: string, patch: Partial<ContributorStats>) => {
    const cur: ContributorStats = map.get(login) ?? { login, commits: 0, prs: 0, reviews: 0, issues: 0, repos: [] };
    const merged: ContributorStats = { ...cur, ...patch, repos: [...cur.repos, ...(patch.repos ?? [])] };
    merged.repos = Array.from(new Set(merged.repos));
    map.set(login, merged);
  };
  const repoSlug = `${repo.owner}/${repo.name}`;
  const [commits, { prLogins, reviewLogins }, issues] = await Promise.all([
    fetchCommits(repo.owner, repo.name, token),
    fetchPrsAndReviews(repo.owner, repo.name, token),
    fetchIssues(repo.owner, repo.name, token),
  ]);
  const commitBuckets = new Map<string, number>();
  for (const l of commits) commitBuckets.set(l, (commitBuckets.get(l) ?? 0) + 1);
  for (const [login, count] of commitBuckets) upsert(login, { commits: count, repos: [repoSlug] });
  const prBuckets = new Map<string, number>();
  for (const l of prLogins) prBuckets.set(l, (prBuckets.get(l) ?? 0) + 1);
  for (const [login, count] of prBuckets) upsert(login, { prs: count, repos: [repoSlug] });
  const rvBuckets = new Map<string, number>();
  for (const l of reviewLogins) rvBuckets.set(l, (rvBuckets.get(l) ?? 0) + 1);
  for (const [login, count] of rvBuckets) upsert(login, { reviews: count, repos: [repoSlug] });
  const isBuckets = new Map<string, number>();
  for (const l of issues) isBuckets.set(l, (isBuckets.get(l) ?? 0) + 1);
  for (const [login, count] of isBuckets) upsert(login, { issues: count, repos: [repoSlug] });
  return map;
}

function aggregateContributions(entries: Array<{ repo: GithubRepo; stats: Map<string, ContributorStats> }>): Map<string, ContributorStats> {
  const agg = new Map<string, ContributorStats>();
  for (const entry of entries) {
    for (const [login, s] of entry.stats) {
      const cur = agg.get(login) ?? { login, commits: 0, prs: 0, reviews: 0, issues: 0, repos: [] };
      cur.commits += s.commits;
      cur.prs += s.prs;
      cur.reviews += s.reviews;
      cur.issues += s.issues;
      for (const r of s.repos) if (!cur.repos.includes(r)) cur.repos.push(r);
      agg.set(login, cur);
    }
  }
  return agg;
}

function scoreContributors(agg: Map<string, ContributorStats>): ContributorScore[] {
  const arr: ContributorScore[] = [];
  for (const s of agg.values()) {
    const score = s.commits * 1 + s.prs * 5 + s.reviews * 3 + s.issues * 2;
    arr.push({ ...s, score });
  }
  arr.sort((a, b) => b.score - a.score || a.login.localeCompare(b.login));
  return arr;
}

async function getContributionScores(
  githubToken: string,
  projectsUrl: string = 'https://bettergov.ph/api/projects.json',
): Promise<ContributorScore[]> {
  const projects = await fetchProjects(projectsUrl);
  const repos = extractRepos(projects);
  const results: Array<{ repo: GithubRepo; stats: Map<string, ContributorStats> }> = [];
  let idx = 0;
  const limit = Math.min(5, Math.max(1, repos.length));
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (true) {
        const i = idx++;
        if (i >= repos.length) return;
        try { results.push({ repo: repos[i], stats: await fetchRepoContributions(repos[i], githubToken) }); } catch { /* noop */ }
      }
    }),
  );
  return scoreContributors(aggregateContributions(results));
}

// ============================================================================
//  Shared admin helpers (from admin.ts)
// ============================================================================

const generateUniqueMemberId = async (client: any, selectedYear: number) => {
  const { data, error } = await client
    .from('users')
    .select('member_id')
    .ilike('member_id', `BGPH-${selectedYear}-%`)
    .order('member_id', { ascending: false })
    .limit(100);
  if (error) throw error;
  let maxSequence = 0;
  for (const u of data ?? []) {
    const m = typeof u.member_id === 'string' ? u.member_id.match(/^BGPH-(\d{4})-(\d{3})$/) : null;
    if (m && parseInt(m[1]) === selectedYear) {
      const seq = parseInt(m[2], 10);
      if (!isNaN(seq) && seq > maxSequence) maxSequence = seq;
    }
  }
  const next = `BGPH-${selectedYear}-${String(maxSequence + 1).padStart(3, '0')}`;
  const { data: dup } = await client.from('users').select('member_id').eq('member_id', next).maybeSingle();
  if (!dup) return next;
  throw new Error('Failed to generate unique member ID');
};

const ensureUserHasMemberId = async (client: any, uid: string) => {
  const { data, error } = await client.from('users').select('member_id, year_joined').eq('uid', uid).maybeSingle();
  if (error) throw error;
  if (data?.member_id) return data.member_id as string;
  const y = data?.year_joined || new Date().getFullYear();
  const id = await generateUniqueMemberId(client, y);
  await client.from('users').update({ member_id: id, updated_at: new Date().toISOString() }).eq('uid', uid);
  return id;
};

const assertAdmin = async (supabaseAdmin: any, uid: string, email?: string) => {
  let { data: callerRow, error: callerError } = await supabaseAdmin
    .from('users').select('uid, is_admin, email').eq('uid', uid).maybeSingle();
  if (!callerRow && email) {
    ({ data: callerRow, error: callerError } = await supabaseAdmin
      .from('users').select('uid, is_admin, email').eq('email', email).maybeSingle());
  }
  if (callerError) return { ok: false as const, error: 'Failed to validate admin' };
  if (!callerRow?.is_admin) return { ok: false as const, error: 'Admin only' };
  return { ok: true as const };
};

// ============================================================================
//  Handlers — each function is a direct inline port of api/_handlers/*.ts
// ============================================================================

type H = (req: any, res: any) => Promise<void>;

// ---------- /me (api/_handlers/me.ts) ---------------------------------------
const handler_me: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') { sendError(res, 405, 'Method not allowed'); return; }
  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    sendError(res, 500, `Server not configured: ${missing.join(', ')}`);
    return;
  }
  const token = getBearerToken(req.headers?.authorization);
  if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  const email = authData?.user?.email ? String(authData.user.email) : '';
  if (authError || !uid) { sendError(res, 401, 'Invalid token'); return; }

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
    if (error) { sendError(res, 500, 'Failed to load profile'); return; }
    if (!data) { sendJson(res, 200, { user: null }); return; }
    if ((!data.email || String(data.email).trim() === '') && email) {
      const { data: updated } = await supabase
        .from('users').update({ email, updated_at: new Date().toISOString() }).eq('uid', uid).select('*').maybeSingle();
      if (updated) { sendJson(res, 200, { user: mapUserRow(updated) }); return; }
    }
    sendJson(res, 200, { user: mapUserRow(data) });
    return;
  }

  const body = getBody(req);
  const updates: any = { updated_at: new Date().toISOString() };
  if (email) updates.email = email;
  if (typeof body.fullName === 'string') updates.full_name = body.fullName.trim().slice(0, 200);
  if (typeof body.specialization === 'string') updates.specialization = body.specialization.trim().slice(0, 100);
  if (typeof body.discordUsername === 'string') updates.discord_username = body.discordUsername.trim().slice(0, 64);
  if (typeof body.yearJoined === 'number' && body.yearJoined >= 2020 && body.yearJoined <= 2100) updates.year_joined = body.yearJoined;
  if (Array.isArray(body.skills) && body.skills.length <= 100) updates.skills = body.skills;
  if (typeof body.experienceLevel === 'string') updates.experience_level = body.experienceLevel.trim().slice(0, 50);
  updates.auth_provider = 'google';

  const { data: existingUser } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
  if (existingUser) {
    const { data: updatedRows, error: updateError } = await supabase
      .from('users').update(updates).eq('uid', uid).select('*');
    if (updateError) { sendError(res, 500, 'Failed to update profile'); return; }
    const updated = Array.isArray(updatedRows) ? updatedRows[0] : null;
    if (updated) { sendJson(res, 200, { user: mapUserRow(updated) }); return; }
  }
  const now = new Date().toISOString();
  const insertRow = {
    uid, email,
    full_name: updates.full_name ?? '',
    specialization: updates.specialization ?? '',
    role: updates.role ?? 'Member',
    discord_username: updates.discord_username ?? '',
    status: 'Pending', is_admin: false, member_id: null,
    created_at: now, updated_at: now,
    skills: updates.skills ?? [],
    experience_level: updates.experience_level ?? null,
    year_joined: updates.year_joined ?? null,
    auth_provider: 'google',
  };
  const { data: insertResult, error: insertError } = await supabase
    .from('users').insert(insertRow).select('*').maybeSingle();
  if (insertError || !insertResult) { sendError(res, 500, 'Failed to create profile'); return; }
  sendJson(res, 200, { user: mapUserRow(insertResult) });
};

// ---------- /admin (api/_handlers/admin.ts) ----------------------------------
const mapSubmissionRow = (row: any, submittedBy?: { fullName: string; email: string }) => ({
  id: row.id, userId: row.user_id,
  projectName: row.project_name ?? '', projectUrl: row.project_url ?? '',
  description: row.description ?? '',
  projType: row.proj_type ?? row.tech_stack ?? undefined,
  status: row.status ?? 'pending', createdAt: row.created_at, submittedBy,
});

const handler_admin: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const resource = getStringParam(req.query?.resource);
  const cfg = getSupabaseConfig();
  const serviceRoleKey = cfg.serviceKey;
  const supabaseUrl = cfg.url;
  const supabaseAnonKey = cfg.anonKey;

  if (req.method === 'GET' && resource === 'stats') {
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
    const supabaseAuth = createAnonClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    const uid = authData?.user?.id ? String(authData.user.id) : '';
    const email = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !uid) { sendError(res, 401, 'Invalid token'); return; }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const adminCheck = await assertAdmin(adminSup, uid, email);
    if (!adminCheck.ok) { sendError(res, 403, adminCheck.error); return; }
    const cacheKey = 'cache:admin:stats';
    try { const c = await getCache<any>(cacheKey); if (c) { sendJson(res, 200, c); return; } } catch { /* noop */ }
    const { count: total } = await adminSup.from('users').select('*', { count: 'exact', head: true });
    const { count: pending } = await adminSup.from('users').select('*', { count: 'exact', head: true })
      .in('status', ['Pending', 'pending', 'PENDING']).not('full_name', 'eq', '');
    const { count: approved } = await adminSup.from('users').select('*', { count: 'exact', head: true })
      .in('status', ['Approved', 'approved', 'APPROVED']);
    const payload = { total: total ?? 0, pending: pending ?? 0, approved: approved ?? 0 };
    try { await setCache(cacheKey, payload, 60); } catch { /* noop */ }
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === 'GET' && resource === 'users') {
    if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminSup.auth.getUser(token);
    const uid = authData?.user?.id ? String(authData.user.id) : '';
    const email = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !uid) { sendError(res, 401, 'Invalid token'); return; }
    const adminCheck = await assertAdmin(adminSup, uid, email);
    if (!adminCheck.ok) { sendError(res, 403, adminCheck.error); return; }
    const page = Math.max(0, getNumberParam(req.query?.page, 0));
    const pageSize = Math.min(100, Math.max(1, getNumberParam(req.query?.pageSize, 20)));
    const statusFilter = getStringParam(req.query?.status);
    const roleFilter = getStringParam(req.query?.role);
    const searchRaw = getStringParam(req.query?.search);
    let query: any = adminSup.from('users').select('*', { count: 'exact' }).eq('is_admin', false).not('full_name', 'eq', '');
    if (statusFilter && statusFilter !== 'All') {
      const variants = Array.from(new Set([statusFilter, statusFilter.toLowerCase(), statusFilter.toUpperCase(),
        statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1).toLowerCase()]));
      query = query.in('status', variants);
    }
    if (roleFilter && roleFilter !== 'All') query = query.eq('specialization', roleFilter);
    if (searchRaw && searchRaw.trim()) {
      const safe = searchRaw.trim().replace(/[%_]/g, '').slice(0, 64);
      const search = `%${safe}%`;
      query = query.or(`full_name.ilike.${search},email.ilike.${search},discord_username.ilike.${search},member_id.ilike.${search}`);
    }
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) { sendError(res, 500, 'Failed to load users'); return; }
    sendJson(res, 200, { users: (data ?? []).map(mapUserRow), totalCount: count ?? 0 });
    return;
  }

  if (req.method === 'POST' && resource === 'user-status') {
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
    const supabaseAuth = createAnonClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    const callerEmail = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !callerUid) { sendError(res, 401, 'Invalid token'); return; }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const adminCheck = await assertAdmin(adminSup, callerUid, callerEmail);
    if (!adminCheck.ok) { sendError(res, adminCheck.error === 'Admin only' ? 403 : 401, adminCheck.error); return; }
    const body = getBody(req);
    const idUid = typeof body.uid === 'string' ? body.uid : typeof body.id === 'string' ? body.id : null;
    const status = typeof body.status === 'string' ? body.status : null;
    const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : undefined;
    const isAdmin = typeof body.isAdmin === 'boolean' ? body.isAdmin : undefined;
    if (!idUid) { sendError(res, 400, 'Missing uid'); return; }
    if (!status && isAdmin === undefined) { sendError(res, 400, 'Must provide status or isAdmin'); return; }
    const updates: any = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (adminNotes !== undefined) updates.admin_notes = adminNotes;
    if (isAdmin !== undefined) {
      if (idUid === callerUid) { sendError(res, 403, 'Cannot modify your own admin status'); return; }
      updates.is_admin = isAdmin;
    }
    let memberId: string | undefined;
    if (status === 'Approved' || isAdmin === true) {
      try { memberId = await ensureUserHasMemberId(adminSup, idUid); updates.member_id = memberId; }
      catch { sendError(res, 500, 'Failed to generate memberId'); return; }
    }
    const { data, error } = await adminSup.from('users').update(updates).eq('uid', idUid).select('*');
    if (error) { sendError(res, 500, 'Failed to update user'); return; }
    if (!data || data.length === 0) { sendError(res, 404, 'User not found'); return; }
    try { await invalidateCache('cache:admin:stats'); await invalidateCache('cache:verify:*'); } catch { /* noop */ }
    sendJson(res, 200, { memberId: memberId ?? data[0]?.member_id ?? null });
    return;
  }

  if (req.method === 'GET' && resource === 'submissions') {
    if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminSup.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    const callerEmail = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !callerUid) { sendError(res, 401, 'Invalid token'); return; }
    const adminCheck = await assertAdmin(adminSup, callerUid, callerEmail);
    if (!adminCheck.ok) { sendError(res, 403, adminCheck.error); return; }
    const page = Math.max(0, getNumberParam(req.query?.page, 0));
    const pageSize = Math.min(100, Math.max(1, getNumberParam(req.query?.pageSize, 20)));
    const statusFilter = getStringParam(req.query?.status);
    let query: any = adminSup.from('project_submissions').select('*', { count: 'exact' });
    if (statusFilter && statusFilter !== 'All') query = query.eq('status', statusFilter);
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) { sendError(res, 500, 'Failed to load project submissions'); return; }
    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    const userMap = new Map<string, { fullName: string; email: string }>();
    if (userIds.length > 0) {
      const { data: usersData } = await adminSup.from('users').select('uid, full_name, email').in('uid', userIds);
      for (const u of usersData ?? []) userMap.set(u.uid, { fullName: u.full_name ?? '', email: u.email ?? '' });
    }
    sendJson(res, 200, {
      submissions: rows.map((r: any) => mapSubmissionRow(r, userMap.get(r.user_id))),
      totalCount: count ?? 0,
    });
    return;
  }

  if (req.method === 'POST' && resource === 'submissions') {
    if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminSup.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    const callerEmail = authData?.user?.email ? String(authData.user.email) : '';
    if (authError || !callerUid) { sendError(res, 401, 'Invalid token'); return; }
    const adminCheck = await assertAdmin(adminSup, callerUid, callerEmail);
    if (!adminCheck.ok) { sendError(res, 403, adminCheck.error); return; }
    const body = getBody(req);
    const id = typeof body.id === 'string' ? body.id : '';
    const action = typeof body.action === 'string' ? body.action : '';
    const deleteUser = typeof body.deleteUser === 'boolean' ? body.deleteUser : false;
    if (!id || (action !== 'approve' && action !== 'reject' && action !== 'delete' && action !== 'update')) {
      sendError(res, 400, 'id and action (approve|reject|delete|update) are required');
      return;
    }
    const { data: submission, error: submissionError } = await adminSup
      .from('project_submissions').select('*').eq('id', id).maybeSingle();
    if (submissionError) { sendError(res, 500, 'Failed to load submission'); return; }
    if (!submission) { sendError(res, 404, 'Submission not found'); return; }
    const invalidateProjectCache = async () => {
      try { await invalidateCache('cache:projects:approved'); await invalidateCache('cache:admin:stats'); }
      catch { /* noop */ }
    };
    if (action === 'approve') {
      const { error: approveError } = await adminSup.from('project_submissions').update({ status: 'approved' }).eq('id', id);
      if (approveError) { sendError(res, 500, 'Failed to approve submission'); return; }
      await invalidateProjectCache();
      sendJson(res, 200, { message: 'Approved submission' });
      return;
    }
    if (action === 'reject') {
      const { error: rejectError } = await adminSup.from('project_submissions').update({ status: 'rejected' }).eq('id', id);
      if (rejectError) { sendError(res, 500, 'Failed to reject submission'); return; }
      await invalidateProjectCache();
      sendJson(res, 200, { message: 'Rejected submission' });
      return;
    }
    if (action === 'update') {
      const updateFields: Record<string, any> = {};
      if (typeof body.project_name === 'string') updateFields.project_name = body.project_name.trim();
      if (typeof body.project_url === 'string') updateFields.project_url = body.project_url.trim();
      if (typeof body.description === 'string') updateFields.description = body.description.trim();
      if (typeof body.proj_type === 'string') updateFields.proj_type = body.proj_type.trim();
      if (typeof body.status === 'string' && ['pending', 'approved', 'rejected'].includes(body.status)) {
        updateFields.status = body.status;
      }
      if (Object.keys(updateFields).length === 0) { sendError(res, 400, 'No fields to update'); return; }
      const { error: updateError } = await adminSup.from('project_submissions').update(updateFields).eq('id', id);
      if (updateError) { sendError(res, 500, 'Failed to update submission'); return; }
      await invalidateProjectCache();
      sendJson(res, 200, { message: 'Updated submission' });
      return;
    }
    if (action === 'delete') {
      const { error: deleteError } = await adminSup.from('project_submissions').delete().eq('id', id);
      if (deleteError) { sendError(res, 500, 'Failed to delete submission'); return; }
      if (deleteUser) {
        const userId = typeof submission.user_id === 'string' ? submission.user_id : '';
        if (userId) {
          await adminSup.from('project_submissions').delete().eq('user_id', userId);
          await adminSup.from('volunteer_calls').delete().eq('user_id', userId);
          await adminSup.from('users').delete().eq('uid', userId);
          try { await adminSup.auth.admin.deleteUser(userId); } catch { /* noop */ }
        }
      }
      await invalidateProjectCache();
      sendJson(res, 200, { message: deleteUser ? 'Deleted submission and user' : 'Deleted submission' });
      return;
    }
    sendError(res, 400, 'Unknown action');
    return;
  }

  sendError(res, 400, 'Unknown resource or method');
};

const normalizeUrl = (value: unknown) => typeof value === 'string' ? value.replace(/`/g, '').trim() : '';
const mapProjectRow = (row: any) => ({
  id: row.id, title: row.project_name ?? row.title ?? '',
  description: row.description ?? '', url: normalizeUrl(row.project_url ?? row.url ?? ''),
  projType: row.proj_type ?? row.tech_stack ?? undefined,
  createdAt: row.created_at ?? undefined,
});

// ---------- /projects --------------------------------------------------------
const normalizeRemoteUrl = (u: unknown): string => {
  if (!u || typeof u !== 'string') return '';
  const s = normalizeUrl(u).replace(/^\/+/, '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return 'https://' + s;
};

const pickRemoteString = (obj: any, keys: string[], fallback = ''): string => {
  for (const k of keys) {
    if (!obj || typeof obj !== 'object') continue;
    if (k.includes('.')) {
      const parts = k.split('.');
      let v: any = obj;
      for (const p of parts) {
        if (v && typeof v === 'object' && p in v) v = v[p]; else { v = undefined; break; }
      }
      if (typeof v === 'string' && v.trim()) return v.trim();
    } else {
      if (typeof obj[k] === 'string' && obj[k].trim()) return obj[k].trim();
    }
  }
  return fallback;
};

const coerceRemoteProject = (row: any) => {
  const title = pickRemoteString(row, ['title', 'project_name', 'projectName', 'name', 'headline']);
  const url = normalizeRemoteUrl(pickRemoteString(row, ['url', 'project_url', 'projectUrl', 'link', 'href', 'website', 'repo', 'repository']));
  const description = pickRemoteString(row, ['description', 'summary', 'body', 'content', 'projectDescription', 'excerpt']);
  const projType = pickRemoteString(row, ['proj_type', 'projType', 'project_type', 'type', 'tech_stack', 'category', 'tag']);
  if (!title || !url || !description) return null;
  return {
    id: `remote-${Buffer.from(url).toString('base64url').slice(0, 20)}`,
    title, description, url, projType,
    createdAt: pickRemoteString(row, ['createdAt', 'created_at', 'publishedAt', 'date']) || new Date().toISOString(),
    source: 'bettergov.ph',
  };
};

const extractRemoteProjects = (node: any): any[] => {
  const out: any[] = [];
  const seen = new Set<string>();
  const visit = (x: any) => {
    if (Array.isArray(x)) { x.forEach(visit); return; }
    if (!x || typeof x !== 'object') return;
    const hit = coerceRemoteProject(x);
    if (hit && !seen.has(hit.url)) { seen.add(hit.url); out.push(hit); }
    for (const k of Object.keys(x)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      visit(x[k]);
    }
  };
  visit(node);
  return out;
};

const BGPH_REMOTE_URL = process.env.BGPH_REMOTE_PROJECTS_URL || 'https://bettergov.ph/api/projects.json';
const BGPH_FETCH_HEADERS = {
  accept: '*/*',
  'accept-language': 'en-US,en;q=0.7',
  referer: 'https://bettergov.ph/projects',
  priority: 'u=1, i',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
};

const fetchRemoteProjects = async (): Promise<any[]> => {
  const cacheKey = 'cache:projects:remote';
  try {
    const cached = await getCache<any[]>(cacheKey);
    if (cached && Array.isArray(cached)) return cached;
  } catch { /* noop */ }
  try {
    const r = await fetch(BGPH_REMOTE_URL, { headers: BGPH_FETCH_HEADERS as any });
    if (!r.ok) return [];
    const text = await r.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return []; }
    const list = extractRemoteProjects(parsed).slice(0, 100);
    try { await setCache(cacheKey, list, 300); } catch { /* noop */ }
    return list;
  } catch {
    return [];
  }
};

const dedupeMergedProjects = (local: any[], remote: any[]): any[] => {
  const map = new Map<string, any>();
  for (const p of local) {
    if (p?.url) map.set(String(p.url), { ...p, source: p.source || 'local' });
  }
  for (const r of remote) {
    if (r?.url && !map.has(String(r.url))) map.set(String(r.url), r);
  }
  return Array.from(map.values());
};

const handler_projects: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  if (req.method !== 'GET') { sendError(res, 405, 'Method not allowed'); return; }
  const sourceParam = typeof req.query?.source === 'string' ? req.query.source.toLowerCase() : '';
  const sourceHeader = typeof req.headers?.['x-bettergov-source'] === 'string' ? req.headers['x-bettergov-source'] : '';
  const mergeRemote = sourceParam === 'merged' || sourceParam === 'remote' || sourceHeader === 'merged' || sourceHeader === 'remote' ||
    sourceParam === '1' || sourceParam === 'true';
  const cacheKey = mergeRemote ? 'cache:projects:approved:merged' : 'cache:projects:approved';
  try { const cached = await getCache<any[]>(cacheKey); if (cached && Array.isArray(cached)) { sendJson(res, 200, { projects: cached, source: mergeRemote ? 'merged' : 'local' }); return; } }
  catch { /* noop */ }
  const { url: supabaseUrl, anonKey, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl) { sendError(res, 500, 'Server not configured'); return; }
  const makeClient = (key: string) => createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const runQuery = async (client: any) => {
    let result = await client
      .from('project_submissions').select('*')
      .in('status', ['approved', 'Approved', 'APPROVED'])
      .order('created_at', { ascending: false }).limit(100);
    if (result.error &&
        typeof (result.error as any)?.message === 'string' &&
        String((result.error as any).message).toLowerCase().includes('created_at')) {
      result = await client
        .from('project_submissions').select('*')
        .in('status', ['approved', 'Approved', 'APPROVED'])
        .order('id', { ascending: false }).limit(100);
    }
    return result;
  };
  let primaryKey = serviceKey || anonKey;
  let fallbackKey = (anonKey && serviceKey && anonKey !== serviceKey) ? anonKey : '';
  if (!primaryKey) { sendError(res, 500, 'Server not configured'); return; }
  let supabase = makeClient(primaryKey);
  let result = await runQuery(supabase);
  if ((result.error || (result.data && result.data.length === 0)) && fallbackKey) {
    supabase = makeClient(fallbackKey);
    result = await runQuery(supabase);
  }
  if (result.error) { sendError(res, 500, 'Failed to load projects'); return; }
  const local = (result.data ?? []).map((r: any) => ({ ...mapProjectRow(r), source: 'local' }));
  if (!mergeRemote) {
    try { await setCache(cacheKey, local, 300); } catch { /* noop */ }
    sendJson(res, 200, { projects: local, source: 'local' });
    return;
  }
  const remote = await fetchRemoteProjects();
  const merged = dedupeMergedProjects(local, remote);
  try { await setCache(cacheKey, merged, 300); } catch { /* noop */ }
  sendJson(res, 200, { projects: merged, source: 'merged', remoteCount: remote.length, localCount: local.length });
};

// ---------- /submit-project (api/_handlers/submit-project.ts) ----------------
const tryInsertSubmission = async (supabaseDb: any, basePayload: Record<string, any>) => {
  const { id: _ignoredId, ...payload } = basePayload;
  const noIdRes = await supabaseDb.from('project_submissions').insert([payload]).select('id').maybeSingle();
  if (!noIdRes.error) return { data: { id: noIdRes.data?.id || 'generated' }, error: null };
  const noIdMsg = String(noIdRes.error?.message || '').toLowerCase();
  const noIdCode = String(noIdRes.error?.code || '');
  if (!(noIdMsg.includes('null value in column "id"') || noIdCode === '23502')) return noIdRes;
  const uuidId = safeRandomUuid();
  const uuidPayload = { ...payload, id: uuidId };
  const uuidRes = await supabaseDb.from('project_submissions').insert([uuidPayload]).select('id').maybeSingle();
  if (!uuidRes.error) return { data: { id: uuidRes.data?.id || uuidId }, error: null };
  const uuidMsg = String(uuidRes.error.message || '').toLowerCase();
  const isIntIdError = /invalid input syntax for type (integer|bigint)|type (bigint|integer)/i.test(uuidMsg);
  const numericId = Math.floor(Math.random() * 1000000000) + Math.floor(Date.now() % 1000000);
  const numericPayload = { ...payload, id: numericId };
  const numRes = await supabaseDb.from('project_submissions').insert([numericPayload]).select('id').maybeSingle();
  if (!numRes.error) return { data: { id: numRes.data?.id || numericId }, error: null };
  const strPayload = { ...payload, id: String(numericId) };
  const strNumRes = await supabaseDb.from('project_submissions').insert([strPayload]).select('id').maybeSingle();
  if (!strNumRes.error) return { data: { id: strNumRes.data?.id || String(numericId) }, error: null };
  return isIntIdError ? numRes : uuidRes;
};

const handler_submit_project: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { sendError(res, 405, 'Method not allowed'); return; }
  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    sendError(res, 500, `Server not configured: ${missing.join(', ')}`);
    return;
  }
  const token = getBearerToken(req.headers?.authorization);
  if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
  const supabaseAuth = createServiceClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  if (authError || !uid) { sendError(res, 401, 'Invalid token'); return; }
  const body = getBody(req);
  const projectName =
    typeof body.project_name === 'string' && body.project_name.trim() ? body.project_name.trim() :
    typeof body.projectName === 'string' && body.projectName.trim() ? body.projectName.trim() :
    typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '';
  const projectUrl =
    typeof body.project_url === 'string' && body.project_url.trim() ? body.project_url.trim() :
    typeof body.projectUrl === 'string' && body.projectUrl.trim() ? body.projectUrl.trim() :
    typeof body.url === 'string' && body.url.trim() ? body.url.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const projTypeRaw =
    typeof body.proj_type === 'string' ? body.proj_type :
    typeof body.projType === 'string' ? body.projType :
    typeof body.project_type === 'string' ? body.project_type :
    typeof body.tech_stack === 'string' ? body.tech_stack : '';
  const projType = projTypeRaw.trim();
  if (!projectName || !projectUrl || !description) {
    sendError(res, 400, 'project_name, project_url, and description are required');
    return;
  }
  const supabaseDb = createServiceClient(supabaseUrl, serviceRoleKey);
  let r = await tryInsertSubmission(supabaseDb, {
    user_id: uid, project_name: projectName, project_url: projectUrl,
    description, proj_type: projType || null, status: 'pending',
  });
  let data = r.data, error = r.error;
  if (error && String(error.message || '').toLowerCase().includes('proj_type')) {
    const r2 = await tryInsertSubmission(supabaseDb, {
      user_id: uid, project_name: projectName, project_url: projectUrl,
      description, tech_stack: projType || null, status: 'pending',
    });
    data = r2.data; error = r2.error;
  }
  if (error && (String(error.message || '').toLowerCase().includes('proj_type') || String(error.message || '').toLowerCase().includes('tech_stack'))) {
    const r3 = await tryInsertSubmission(supabaseDb, {
      user_id: uid, project_name: projectName, project_url: projectUrl, description, status: 'pending',
    });
    data = r3.data; error = r3.error;
  }
  if (error && (String(error.message || '').toLowerCase().includes('project_name') || String(error.message || '').toLowerCase().includes('project_url'))) {
    const r4 = await tryInsertSubmission(supabaseDb, {
      user_id: uid, title: projectName, url: projectUrl, description,
      proj_type: projType || null, status: 'pending',
    });
    data = r4.data; error = r4.error;
  }
  if (error && (String(error.message || '').toLowerCase().includes('project_name') || String(error.message || '').toLowerCase().includes('project_url') ||
      String(error.message || '').toLowerCase().includes('proj_type') || String(error.message || '').toLowerCase().includes('tech_stack'))) {
    const r5 = await tryInsertSubmission(supabaseDb, {
      user_id: uid, title: projectName, url: projectUrl, description, status: 'pending',
    });
    data = r5.data; error = r5.error;
  }
  if (error && String(error.message || '').toLowerCase().includes('status')) {
    const r6 = await tryInsertSubmission(supabaseDb, {
      user_id: uid, project_name: projectName, project_url: projectUrl, description,
    });
    data = r6.data; error = r6.error;
  }
  if (error || !data?.id) {
    console.error('[Submit Project API Error]:', error);
    sendError(res, 500, error?.message ? `Failed to submit project: ${error.message}` : 'Failed to submit project');
    return;
  }
  try { await invalidateCache('cache:admin:stats'); } catch { /* noop */ }
  sendJson(res, 200, { message: 'Submitted successfully!', submissionId: data.id });
};

// ---------- /my-project-submissions (api/_handlers/my-project-submissions.ts)
const mapMySubmissionRow = (row: any) => ({
  id: row.id, userId: row.user_id,
  projectName: row.project_name ?? '', projectUrl: row.project_url ?? '',
  description: row.description ?? '',
  projType: row.proj_type ?? row.tech_stack ?? undefined,
  status: row.status ?? 'pending', createdAt: row.created_at,
});

const handler_my_project_submissions: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { sendError(res, 405, 'Method not allowed'); return; }
  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
  const token = getBearerToken(req.headers?.authorization);
  if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  if (authError || !uid) { sendError(res, 401, 'Invalid token'); return; }
  const page = Math.max(0, getNumberParam(req.query?.page, 0));
  const pageSize = Math.min(100, Math.max(1, getNumberParam(req.query?.pageSize, 20)));
  const result = await supabase
    .from('project_submissions').select('*', { count: 'exact' }).eq('user_id', uid)
    .order('created_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
  if (result.error) { sendError(res, 500, 'Failed to load submissions'); return; }
  sendJson(res, 200, {
    submissions: (result.data ?? []).map(mapMySubmissionRow),
    totalCount: result.count ?? 0,
  });
};

// ---------- /volunteer-calls (api/_handlers/volunteer-calls.ts) -------------
const mapCallRow = (row: any, postedBy?: { fullName: string; email: string }) => ({
  id: row.id, userId: row.user_id, title: row.title ?? '',
  projectUrl: row.project_url ?? '', description: row.description ?? '',
  rolesNeeded: row.roles_needed ?? undefined, contact: row.contact ?? undefined,
  status: row.status ?? 'open', createdAt: row.created_at, postedBy,
});

const handler_volunteer_calls: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE' && req.method !== 'PATCH' && req.method !== 'PUT') {
    sendError(res, 405, 'Method not allowed'); return;
  }
  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
  const token = getBearerToken(req.headers?.authorization);
  if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  if (authError || !uid) { sendError(res, 401, 'Invalid token'); return; }
  const { data: callerRow } = await supabase.from('users').select('is_admin').eq('uid', uid).maybeSingle();
  const isAdmin = !!callerRow?.is_admin;

  if (req.method === 'GET') {
    const mine = getStringParam(req.query?.mine);
    const adminMode = getStringParam(req.query?.admin);
    const wantsAdmin = adminMode === '1' || adminMode === 'true';
    const statusFilter = getStringParam(req.query?.status);
    if (wantsAdmin && !isAdmin) { sendError(res, 403, 'Admin only'); return; }
    let query: any = supabase.from('volunteer_calls').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (mine === '1' || mine === 'true') query = query.eq('user_id', uid);
    if (!wantsAdmin && mine !== '1' && mine !== 'true') {
      if (uid) query = query.or(`status.eq.open,user_id.eq.${uid}`);
      else query = query.eq('status', 'open');
    }
    if (wantsAdmin && statusFilter && statusFilter !== 'All') query = query.eq('status', statusFilter);
    const { data, error, count } = await query.limit(50);
    if (error) { sendError(res, 500, 'Failed to load volunteer calls'); return; }
    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    const userMap = new Map<string, { fullName: string; email: string }>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase.from('users').select('uid, full_name, email').in('uid', userIds);
      if (usersData) for (const u of usersData) userMap.set(u.uid, { fullName: u.full_name ?? '', email: u.email ?? '' });
    }
    sendJson(res, 200, {
      calls: rows.map((r: any) => mapCallRow(r, userMap.get(r.user_id))),
      totalCount: count ?? 0,
    });
    return;
  }

  const body = getBody(req);
  const isUpdate = req.method === 'PATCH' || req.method === 'PUT' ||
    (req.method === 'POST' && (Boolean(body.id) || body.action === 'update' || body.action === 'edit'));
  if (isUpdate) {
    const id = typeof body.id === 'string' ? body.id : getStringParam(req.query?.id) || '';
    if (!id) { sendError(res, 400, 'id is required'); return; }
    const { data: call, error: callError } = await supabase
      .from('volunteer_calls').select('id, user_id').eq('id', id).maybeSingle();
    if (callError) { sendError(res, 500, 'Failed to load volunteer call'); return; }
    if (!call) { sendError(res, 404, 'Volunteer call not found'); return; }
    if (!isAdmin && (call as any).user_id !== uid) {
      sendError(res, 403, 'Forbidden: You do not own this volunteer call'); return;
    }
    const updateFields: Record<string, any> = {};
    if (typeof body.title === 'string') updateFields.title = body.title.trim();
    if (typeof body.project_url === 'string') updateFields.project_url = body.project_url.trim();
    if (typeof body.projectUrl === 'string') updateFields.project_url = body.projectUrl.trim();
    if (typeof body.description === 'string') updateFields.description = body.description.trim();
    if (typeof body.roles_needed === 'string') updateFields.roles_needed = body.roles_needed.trim() || null;
    if (typeof body.rolesNeeded === 'string') updateFields.roles_needed = body.rolesNeeded.trim() || null;
    if (typeof body.contact === 'string') updateFields.contact = body.contact.trim() || null;
    if (typeof body.status === 'string' && ['open', 'closed'].includes(body.status.toLowerCase())) {
      updateFields.status = body.status.toLowerCase();
    }
    if (Object.keys(updateFields).length === 0) { sendError(res, 400, 'No fields to update'); return; }
    const { error: updateError } = await supabase.from('volunteer_calls').update(updateFields).eq('id', id);
    if (updateError) { sendError(res, 500, 'Failed to update volunteer call'); return; }
    sendJson(res, 200, { message: 'Updated volunteer call successfully' });
    return;
  }

  if (req.method === 'DELETE') {
    const id = typeof body.id === 'string' ? body.id : getStringParam(req.query?.id) || '';
    const deleteUser = typeof body.deleteUser === 'boolean' ? body.deleteUser : false;
    if (!id) { sendError(res, 400, 'id is required'); return; }
    const { data: call, error: callError } = await supabase
      .from('volunteer_calls').select('id, user_id').eq('id', id).maybeSingle();
    if (callError) { sendError(res, 500, 'Failed to load volunteer call'); return; }
    if (!call) { sendError(res, 404, 'Volunteer call not found'); return; }
    if (!isAdmin && (call as any).user_id !== uid) {
      sendError(res, 403, 'Forbidden: You do not own this volunteer call'); return;
    }
    const { error: deleteError } = await supabase.from('volunteer_calls').delete().eq('id', id);
    if (deleteError) { sendError(res, 500, 'Failed to delete volunteer call'); return; }
    if (deleteUser && isAdmin) {
      const userId = typeof (call as any).user_id === 'string' ? String((call as any).user_id) : '';
      if (userId) {
        await supabase.from('project_submissions').delete().eq('user_id', userId);
        await supabase.from('volunteer_calls').delete().eq('user_id', userId);
        await supabase.from('users').delete().eq('uid', userId);
        try { await supabase.auth.admin.deleteUser(userId); } catch { /* noop */ }
      }
    }
    sendJson(res, 200, { message: deleteUser && isAdmin ? 'Deleted volunteer call and user' : 'Deleted volunteer call' });
    return;
  }

  if (body.id) { sendError(res, 400, 'Cannot insert a new call with an existing ID'); return; }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const projectUrl = typeof body.project_url === 'string' ? body.project_url.trim() :
    typeof body.projectUrl === 'string' ? body.projectUrl.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const rolesNeeded = typeof body.roles_needed === 'string' ? body.roles_needed.trim() :
    typeof body.rolesNeeded === 'string' ? body.rolesNeeded.trim() : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  if (!title || !projectUrl || !description) {
    sendError(res, 400, 'title, project_url, and description are required'); return;
  }
  const basePayload: Record<string, any> = {
    user_id: uid, title, project_url: projectUrl, description,
    roles_needed: rolesNeeded || null, contact: contact || null, status: 'open',
  };
  let { data, error } = await supabase.from('volunteer_calls').insert([basePayload]).select('id').maybeSingle();
  const missingIdDefault = error && (
    String(error.message || '').toLowerCase().includes('null value in column "id"') ||
    String((error as any).code || '') === '23502');
  if (missingIdDefault) {
    const uuidId = safeRandomUuid();
    ({ data, error } = await supabase.from('volunteer_calls')
      .insert([{ ...basePayload, id: uuidId }]).select('id').maybeSingle());
    const uuidInvalid = error && /invalid input syntax for type (integer|bigint)|type (bigint|integer)/i.test(String(error.message || ''));
    if (uuidInvalid) {
      const numericId = Math.floor(Math.random() * 1000000000) + Math.floor(Date.now() % 1000000);
      ({ data, error } = await supabase.from('volunteer_calls')
        .insert([{ ...basePayload, id: numericId }]).select('id').maybeSingle());
    }
  }
  if (error || !data?.id) {
    console.error('[Volunteer Calls API Error]:', error);
    sendError(res, 500, error?.message ? `Failed to create volunteer call: ${error.message}` : 'Failed to create volunteer call');
    return;
  }
  sendJson(res, 200, { message: 'Posted successfully!', id: data.id });
};

// ---------- /verify (api/_handlers/verify.ts) -------------------------------
const isSafeMemberId = (value: string) => /^BGPH-\d{4}-\d{3}$/i.test(value);
const normalizeLookupId = (raw: string) => raw.trim().toUpperCase();

const handler_verify: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') { sendError(res, 405, 'Method not allowed'); return; }
  const { url: supabaseUrl, anonKey, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !anonKey) { sendError(res, 500, 'Server not configured'); return; }
  const queryId = getStringParam(req.query?.id ?? req.query?.memberId);
  const bodyId = getStringParam(req.body?.id ?? req.body?.memberId);
  const lookupRaw = queryId ?? bodyId;
  if (!lookupRaw) { sendError(res, 400, 'Missing id (memberId)'); return; }
  const lookup = normalizeLookupId(lookupRaw);
  if (!isSafeMemberId(lookup) && !isUuid(lookupRaw.trim())) { sendError(res, 400, 'Invalid id format'); return; }
  const token = getBearerToken(req.headers?.authorization);
  let isAdminCaller = false;
  if (token && serviceKey) {
    try {
      const adminSupabase = createServiceClient(supabaseUrl, serviceKey);
      const { data: authData } = await adminSupabase.auth.getUser(token);
      if (authData?.user) {
        const callerUid = authData.user.id;
        const { data: callerRow } = await adminSupabase
          .from('users').select('is_admin').eq('uid', callerUid).maybeSingle();
        isAdminCaller = !!callerRow?.is_admin;
      }
    } catch { isAdminCaller = false; }
  }
  const cacheKey = `cache:verify:${lookup}`;
  if (!isAdminCaller) {
    try { const cached = await getCache<any>(cacheKey); if (cached) { sendJson(res, 200, cached); return; } }
    catch { /* noop */ }
  }
  const anonSupabase = createAnonClient(supabaseUrl, anonKey);
  let row: any | null = null;
  const exactMemberId = lookup.startsWith('BGPH-') ? lookup : `BGPH-${lookup}`;
  if (isSafeMemberId(exactMemberId)) {
    const { data, error } = await anonSupabase
      .from('users')
      .select('uid, full_name, specialization, role, status, member_id, year_joined, discord_username, is_admin')
      .eq('member_id', exactMemberId).maybeSingle();
    if (error) { sendError(res, 500, 'Lookup failed'); return; }
    row = data ?? null;
  }
  if (!row && isAdminCaller && isUuid(lookupRaw.trim())) {
    const { data, error } = await anonSupabase
      .from('users')
      .select('uid, full_name, specialization, role, status, member_id, year_joined, discord_username, is_admin')
      .eq('uid', lookupRaw.trim()).maybeSingle();
    if (error) { sendError(res, 500, 'Lookup failed'); return; }
    row = data ?? null;
  }
  if (!row) { sendError(res, 404, 'Not found'); return; }
  if (!isAdminCaller) {
    const isApproved = ['approved', 'Approved', 'APPROVED'].includes(String(row.status ?? '')) || !!row.is_admin;
    if (!isApproved) { sendError(res, 404, 'Not found'); return; }
  }
  const responsePayload = {
    uid: row.uid, fullName: row.full_name ?? '', specialization: row.specialization ?? '',
    role: row.role ?? 'Member',
    status: isAdminCaller ? (row.status ?? 'Pending') : 'Approved',
    memberId: row.member_id ?? null, yearJoined: row.year_joined ?? null,
    discordUsername: row.discord_username ?? '', isAdmin: !!row.is_admin,
  };
  if (!isAdminCaller) {
    try { await setCache(cacheKey, responsePayload, 300); } catch { /* noop */ }
  }
  sendJson(res, 200, responsePayload);
};

// ---------- /discord (api/_handlers/discord.ts) -----------------------------
const resolveDiscordProfile = async (discordId: string, botToken: string) => {
  if (!botToken || !discordId) return null;
  try {
    const r = await fetch(`https://discord.com/api/v10/users/${discordId}`, { headers: { Authorization: `Bot ${botToken}` } });
    if (!r.ok) return null;
    const d = await r.json() as { username?: string; global_name?: string | null; avatar?: string | null };
    return { username: d?.username ?? null, displayName: d?.global_name ?? null, avatar: d?.avatar ?? null };
  } catch { return null; }
};

const handler_discord: H = async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const cfg = getSupabaseConfig();
    const supabaseUrl = cfg.url;
    const serviceRoleKey = cfg.serviceKey;
    const bettygoKey = process.env.BETTYGO_API_KEY || '';
    const bettygoBaseUrl = (process.env.BETTYGO_BASE_URL || '').replace(/\/$/, '');
    const callbackUrl = process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/discord-callback';
    const discordBotToken = process.env.DISCORD_BOT_TOKEN || '';
    if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
    if (!bettygoBaseUrl) { sendError(res, 500, 'BETTYGO_BASE_URL is not configured'); return; }
    const supabase = createServiceClient(supabaseUrl, serviceRoleKey);
    const token = getBearerToken(req.headers?.authorization);
    if (!token && req.method !== 'GET') { sendError(res, 401, 'Missing Authorization bearer token'); return; }
    let uid: string | null = null;
    if (token) {
      try { const { data: authData } = await supabase.auth.getUser(token); uid = authData?.user?.id ? String(authData.user.id) : null; }
      catch { uid = null; }
    }

    if (req.method === 'GET') {
      if (!bettygoKey) { sendJson(res, 200, { connected: false }); return; }
      if (!uid) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
      const { data: userData } = await supabase
        .from('users').select('discord_id, discord_username, discord_display_name, discord_avatar').eq('uid', uid).maybeSingle();
      const discordId = userData?.discord_id;
      const discordUsername = userData?.discord_username ?? null;
      let discordDisplayName = userData?.discord_display_name ?? null;
      let discordAvatar = userData?.discord_avatar ?? null;
      if (!discordId) { sendJson(res, 200, { connected: false }); return; }
      let resolvedUsername = discordUsername;
      if (!resolvedUsername) {
        const profile = await resolveDiscordProfile(discordId, discordBotToken);
        if (profile) {
          resolvedUsername = profile.username;
          discordDisplayName = profile.displayName;
          discordAvatar = profile.avatar;
          await supabase.from('users').update({
            discord_username: profile.username, discord_display_name: profile.displayName,
            discord_avatar: profile.avatar, updated_at: new Date().toISOString(),
          }).eq('uid', uid);
        }
      }
      const bettygoRes = await fetch(`${bettygoBaseUrl}/users/${discordId}/discord`, { headers: { 'X-Api-Key': bettygoKey } });
      if (!bettygoRes.ok) { sendJson(res, 502, { connected: true, discord_id: discordId, error: 'Failed to check Discord status' }); return; }
      const d = await bettygoRes.json();
      const verified = d?.verified ?? false;
      if (verified) {
        const { data: currentUser } = await supabase.from('users').select('status').eq('uid', uid).maybeSingle();
        if (currentUser && currentUser.status !== 'Approved') {
          await supabase.from('users').update({ status: 'Approved', updated_at: new Date().toISOString() }).eq('uid', uid);
          try { await ensureUserHasMemberId(supabase, uid); } catch { /* noop */ }
        }
      }
      sendJson(res, 200, { connected: true, discord_id: discordId, discord_username: resolvedUsername,
        discord_display_name: discordDisplayName, discord_avatar: discordAvatar, ...d });
      return;
    }

    if (req.method === 'POST') {
      const action = req.query?.action || 'sync';
      if (action === 'login') {
        if (!bettygoKey) { sendError(res, 500, 'Discord integration not configured'); return; }
        if (!uid) { sendError(res, 401, 'Invalid token'); return; }
        const params = new URLSearchParams({ user_id: uid, redirect_uri: callbackUrl });
        const bettygoRes = await fetch(`${bettygoBaseUrl}/auth/login?${params.toString()}`, { headers: { 'X-Api-Key': bettygoKey } });
        if (!bettygoRes.ok) { sendJson(res, 502, { error: 'Failed to initiate Discord OAuth' }); return; }
        const d = await bettygoRes.json();
        sendJson(res, 200, { url: d.url });
        return;
      }
      if (action === 'sync') {
        if (!bettygoKey) { sendError(res, 500, 'Discord integration not configured'); return; }
        if (!uid) { sendError(res, 401, 'Invalid token'); return; }
        const body = req.body ?? {};
        const discordIdFromBody: string | undefined = typeof body.discord_id === 'string' ? body.discord_id : undefined;
        const discordUsernameFromBody: string | undefined = typeof body.discord_username === 'string' ? body.discord_username.trim() : undefined;
        const discordDisplayNameFromBody: string | undefined =
          typeof body.discord_display_name === 'string' ? (body.discord_display_name.trim() || undefined) : undefined;
        const discordAvatarFromBody: string | undefined =
          typeof body.discord_avatar === 'string' ? (body.discord_avatar.trim() || undefined) : undefined;
        const { data: userData } = await supabase
          .from('users').select('discord_id').eq('uid', uid).maybeSingle();
        const discordId = discordIdFromBody ?? userData?.discord_id;
        if (!discordId) { sendJson(res, 200, { connected: false }); return; }
        const bettygoRes = await fetch(`${bettygoBaseUrl}/users/${discordId}/discord`, { headers: { 'X-Api-Key': bettygoKey } });
        if (!bettygoRes.ok) { sendJson(res, 200, { connected: false }); return; }
        const { verified } = await bettygoRes.json();
        let discordUsername = discordUsernameFromBody ?? null;
        let discordDisplayName = discordDisplayNameFromBody ?? null;
        let discordAvatar = discordAvatarFromBody ?? null;
        if (!discordUsername) {
          const profile = await resolveDiscordProfile(discordId, discordBotToken);
          if (profile) { discordUsername = profile.username; discordDisplayName = profile.displayName; discordAvatar = profile.avatar; }
        }
        const updateFields: any = {
          discord_id: discordId, discord_username: discordUsername, discord_display_name: discordDisplayName,
          discord_avatar: discordAvatar, discord_connected: true, discord_verified: !!verified,
          updated_at: new Date().toISOString(),
        };
        if (verified) updateFields.status = 'Approved';
        await supabase.from('users').update(updateFields).eq('uid', uid);
        let memberId: string | null = null;
        if (verified) { try { memberId = await ensureUserHasMemberId(supabase, uid); } catch { /* noop */ } }
        sendJson(res, 200, { connected: true, discord_id: discordId, discord_username: discordUsername,
          discord_display_name: discordDisplayName, discord_avatar: discordAvatar, verified, memberId });
        return;
      }
      sendError(res, 400, 'Unknown action');
      return;
    }
    sendError(res, 405, 'Method not allowed');
  } catch (err: any) {
    console.error('Discord API error:', err);
    sendError(res, 500, 'Internal server error');
  }
};

// ---------- /discord-username-taken (api/_handlers/discord-username-taken.ts)
const handler_discord_username_taken: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { sendError(res, 405, 'Method not allowed'); return; }
  const { url: supabaseUrl, anonKey } = getSupabaseConfig();
  if (!supabaseUrl || !anonKey) { sendError(res, 500, 'Server not configured'); return; }
  const usernameRaw = getStringParam(req.query?.username);
  const username = (usernameRaw ?? '').trim();
  if (!username || username.length < 2 || username.length > 64) {
    sendError(res, 400, 'Invalid username'); return;
  }
  const supabase = createAnonClient(supabaseUrl, anonKey);
  const { data, error } = await supabase
    .from('users').select('uid').eq('discord_username', username).maybeSingle();
  if (error) { sendError(res, 500, 'Lookup failed'); return; }
  sendJson(res, 200, { taken: !!data });
};

// ---------- /contribution-scores (api/_handlers/contribution-scores.ts) -----
const handler_contribution_scores: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { sendError(res, 405, 'Method not allowed'); return; }
  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) { sendError(res, 500, 'Server not configured'); return; }
  const bearerToken = getBearerToken(req.headers?.authorization);
  if (!bearerToken) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
  const supabase = createServiceClient(supabaseUrl, serviceKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(bearerToken);
  if (authError || !authData?.user?.id) { sendError(res, 401, 'Invalid token'); return; }
  const githubToken = process.env.GITHUB_TOKEN ?? '';
  if (!githubToken) { sendError(res, 500, 'Server not configured'); return; }
  try {
    const scores = await getContributionScores(githubToken);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    sendJson(res, 200, { scores, generatedAt: new Date().toISOString() });
  } catch { sendError(res, 500, 'Failed to compute scores'); }
};

// ============================================================================
//  Router + top-level crash guards
// ============================================================================

let bootFailure: string | null = null;

try {
  if (typeof process !== 'undefined' && typeof (process as any).on === 'function') {
    try {
      (process as any).on('unhandledRejection', (reason: unknown) => {
        console.error('[API][unhandled-rejection]', reason);
      });
      (process as any).on('uncaughtException', (err: unknown) => {
        console.error('[API][uncaught-exception]', err);
      });
    } catch { /* noop */ }
  }
} catch (err) { bootFailure = errorToString(err); }

const normalizePath = (req: any): string => {
  try {
    const host = (req.headers?.host as string) || 'localhost';
    const fullUrl = new URL(req.url || '/', `http://${host}`);
    let pathname = fullUrl.pathname;
    const pathQuery = req.query?.path;
    if (typeof pathQuery === 'string' && pathQuery.length > 0) {
      pathname = '/' + pathQuery.replace(/^\/+/, '');
    } else if (Array.isArray(pathQuery) && pathQuery.length > 0) {
      pathname = '/' + pathQuery.join('/');
    }
    if (pathname.startsWith('/api/v1')) pathname = pathname.slice('/api/v1'.length);
    else if (pathname.startsWith('/api')) pathname = pathname.slice('/api'.length);
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    return pathname || '/';
  } catch (err) {
    console.error('[API][normalize-path-error]', err);
    return '/';
  }
};

type HandlerKey =
  | '/me' | '/admin' | '/projects' | '/submit-project' | '/my-project-submissions'
  | '/volunteer-calls' | '/verify' | '/discord' | '/discord-username-taken' | '/contribution-scores';

const HANDLERS: Record<HandlerKey, H> = {
  '/me': handler_me,
  '/admin': handler_admin,
  '/projects': handler_projects,
  '/submit-project': handler_submit_project,
  '/my-project-submissions': handler_my_project_submissions,
  '/volunteer-calls': handler_volunteer_calls,
  '/verify': handler_verify,
  '/discord': handler_discord,
  '/discord-username-taken': handler_discord_username_taken,
  '/contribution-scores': handler_contribution_scores,
};

const callHandler = async (key: HandlerKey, req: any, res: any) => {
  const fn = HANDLERS[key];
  if (!fn) { sendError(res, 500, `Handler ${key} not registered`); return; }
  try { await fn(req, res); }
  catch (err) {
    console.error('[API][handler-error]', { key, error: err });
    sendError(res, 500, errorToString(err));
  }
};

async function handleRequest(req: any, res: any) {
  try {
    try {
      res.setHeader('X-API-Version', LIB_API_VERSION);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
    } catch { /* headers already sent */ }

    if (bootFailure) { sendError(res, 500, bootFailure); return; }

    if (req.method === 'OPTIONS') {
      try { res.statusCode = 204; res.end(); } catch { /* noop */ }
      return;
    }

    const pathname = normalizePath(req);

    if (pathname === '/me' || pathname === '/') return callHandler('/me', req, res);
    if (pathname === '/admin') return callHandler('/admin', req, res);
    if (pathname === '/projects') return callHandler('/projects', req, res);
    if (pathname === '/submit-project') return callHandler('/submit-project', req, res);
    if (pathname === '/my-project-submissions') return callHandler('/my-project-submissions', req, res);
    if (pathname === '/volunteer-calls' || pathname.startsWith('/volunteer-calls/')) return callHandler('/volunteer-calls', req, res);

    if (pathname.startsWith('/verify')) {
      const parts = pathname.split('/verify/').filter(Boolean);
      if (parts.length > 0) {
        if (!req.query) req.query = {};
        req.query.id = parts[0];
        req.query.memberId = parts[0];
      }
      return callHandler('/verify', req, res);
    }

    if (pathname === '/discord') return callHandler('/discord', req, res);
    if (pathname === '/discord-username-taken') return callHandler('/discord-username-taken', req, res);
    if (pathname === '/contribution-scores') return callHandler('/contribution-scores', req, res);

    sendError(res, 404, 'API endpoint not found');
  } catch (err) {
    console.error('[API][request-error]', { path: req.url, error: err });
    sendError(res, 500, errorToString(err));
  }
}

export default handleRequest;
