import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

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
  links: row.links && typeof row.links === 'object' && !Array.isArray(row.links) ? row.links : {},
  secondarySpecialization: row.secondary_specialization ?? undefined,
  showInDirectory: row.show_in_directory !== false,
  showFullName: row.show_full_name === true,
  consentVersion: row.consent_version ?? undefined,
  consentAt: row.consent_at ?? undefined,
  consentPurposes: Array.isArray(row.consent_purposes) ? row.consent_purposes : [],
  deletionRequestedAt: row.deletion_requested_at ?? undefined,
});

// Profile links (YouTube, GitHub, …): known platforms only, https URLs only, short. Private to the member and admins.
const LINK_KEYS = ['youtube', 'tiktok', 'facebook', 'instagram', 'x', 'linkedin', 'github', 'portfolio'];
const sanitizeLinks = (input: unknown): Record<string, string> | null => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out: Record<string, string> = {};
  for (const key of LINK_KEYS) {
    const raw = (input as Record<string, unknown>)[key];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const value = raw.trim().slice(0, 300);
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:') continue;
      out[key] = u.toString();
    } catch { /* drop anything that isn't a valid URL */ }
  }
  return out;
};

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

// ============================================================================
//  Privacy, consent, teams and repo tracking (migration 20261105000000)
// ============================================================================

/** Before a migration runs, Postgres/PostgREST reports the new column as missing; callers retry without it. */
const isMissingColumnError = (err: any) =>
  /column .* does not exist|could not find the .* column|schema cache|does not exist/i.test(String(err?.message || ''));
const isMissingTableError = (err: any) =>
  /relation .* does not exist|could not find the table|schema cache/i.test(String(err?.message || ''));

/** "John Kylle Cruz" → "John K**** C****". Public pages never show a full name unless the member opts in. */
/** Only http(s) links are stored — no javascript:, data: or other schemes that could run in a browser. */
const safeHttpUrl = (raw: string): string => {
  try {
    const u = new URL(raw);
    return (u.protocol === 'https:' || u.protocol === 'http:') && raw.length <= 500 ? u.toString() : '';
  } catch { return ''; }
};

const redactName = (full: string) => {
  const words = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'Member';
  const [first, ...rest] = words;
  return [first, ...rest.map((w) => `${(Array.from(w)[0] || '').toUpperCase()}****`)].join(' ');
};
const publicNameOf = (row: any) =>
  row?.show_full_name === true ? String(row.full_name || '').trim() || 'Member' : redactName(row?.full_name || '');

const discordAvatarOf = (row: any, size = 96) =>
  /^\d+$/.test(String(row?.discord_id ?? '')) && /^(a_)?[a-f0-9]+$/i.test(String(row?.discord_avatar ?? ''))
    ? `https://cdn.discordapp.com/avatars/${row.discord_id}/${row.discord_avatar}.png?size=${size}`
    : null;

// ----- Data Privacy Act (RA 10173) consent ---------------------------------
const CONSENT_VERSION = '2026-11-v1';
const CONSENT_PURPOSES = ['membership', 'matching', 'directory', 'communications'] as const;
const REQUIRED_PURPOSES = ['membership', 'matching'];

const authCaller = async (req: any) => {
  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey) return { error: 'Server not configured' as const };
  const supabase = createServiceClient(url, serviceKey);
  const token = getBearerToken(req.headers?.authorization);
  if (!token) return { supabase, uid: '', email: '' };
  const { data } = await supabase.auth.getUser(token);
  return { supabase, uid: data?.user?.id ? String(data.user.id) : '', email: data?.user?.email ? String(data.user.email) : '' };
};

// ----- GitHub repo tracker ---------------------------------------------------
const parseGithubRepo = (raw: unknown): { owner: string; name: string } | null => {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?(?:[/?#].*)?$/i);
  return m ? { owner: m[1], name: m[2] } : null;
};

interface RepoStats {
  slug: string; url: string; ok: boolean; error?: string;
  description?: string | null; language?: string | null; stars?: number; forks?: number;
  openIssues?: number; closedIssues?: number; openPrs?: number; mergedPrs?: number;
  commits30d?: number; lastCommitAt?: string | null; lastCommitMessage?: string | null;
  ci?: 'passing' | 'failing' | 'pending' | null; archived?: boolean; isPrivate?: boolean;
  hasReadme?: boolean; license?: string | null;
  release?: { tag: string; at: string } | null;
  milestone?: { title: string; dueOn: string | null; percent: number } | null;
  /** Derived for the UI */
  activity?: 'active' | 'quiet' | 'stale' | 'archived';
  progress?: { percent: number; basis: 'milestone' | 'issues' } | null;
  checks?: { key: string; label: string; ok: boolean }[];
  checkedAt: string;
}

const deriveRepo = (s: RepoStats): RepoStats => {
  if (!s.ok) return s;
  const days = s.lastCommitAt ? (Date.now() - new Date(s.lastCommitAt).getTime()) / 86_400_000 : Infinity;
  s.activity = s.archived ? 'archived' : days <= 14 ? 'active' : days <= 60 ? 'quiet' : 'stale';
  const issuesTotal = (s.openIssues ?? 0) + (s.closedIssues ?? 0);
  s.progress = s.milestone
    ? { percent: Math.round(s.milestone.percent), basis: 'milestone' }
    : issuesTotal > 0 ? { percent: Math.round(((s.closedIssues ?? 0) / issuesTotal) * 100), basis: 'issues' } : null;
  s.checks = [
    { key: 'public', label: 'Public repository', ok: !s.isPrivate },
    { key: 'readme', label: 'Has a README', ok: !!s.hasReadme },
    { key: 'license', label: 'Has an open-source license', ok: !!s.license },
    { key: 'recent', label: 'Commits in the last 60 days', ok: days <= 60 },
    { key: 'ci', label: 'Checks passing on the main branch', ok: s.ci === 'passing' || s.ci === null },
  ];
  return s;
};

const REPO_GQL = `query($owner:String!,$name:String!,$since:GitTimestamp!){
  repository(owner:$owner,name:$name){
    description isArchived isPrivate stargazerCount forkCount url
    primaryLanguage{name} licenseInfo{spdxId}
    openIssues:issues(states:OPEN){totalCount} closedIssues:issues(states:CLOSED){totalCount}
    openPrs:pullRequests(states:OPEN){totalCount} mergedPrs:pullRequests(states:MERGED){totalCount}
    readme:object(expression:"HEAD:README.md"){id} readmeLower:object(expression:"HEAD:readme.md"){id}
    latestRelease{tagName publishedAt}
    milestones(states:OPEN,first:1,orderBy:{field:DUE_DATE,direction:ASC}){nodes{title dueOn progressPercentage}}
    defaultBranchRef{target{... on Commit{committedDate messageHeadline statusCheckRollup{state} history(since:$since){totalCount}}}}
  }
}`;

const fetchRepoStats = async (repoUrl: string): Promise<RepoStats> => {
  const parsed = parseGithubRepo(repoUrl);
  const checkedAt = new Date().toISOString();
  if (!parsed) return { slug: '', url: repoUrl, ok: false, error: 'Not a GitHub repository link (github.com/owner/repo).', checkedAt };
  const slug = `${parsed.owner}/${parsed.name}`;
  const url = `https://github.com/${slug}`;
  const token = process.env.GITHUB_TOKEN ?? '';
  try {
    if (token) {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const gql = await ghGql(token, REPO_GQL, { owner: parsed.owner, name: parsed.name, since });
      const r = gql?.data?.repository;
      if (!r) return { slug, url, ok: false, error: 'Repository not found, or it is private.', checkedAt };
      const head = r.defaultBranchRef?.target;
      const rollup = String(head?.statusCheckRollup?.state || '').toUpperCase();
      const ms = r.milestones?.nodes?.[0];
      return deriveRepo({
        slug, url: r.url || url, ok: true, checkedAt,
        description: r.description ?? null, language: r.primaryLanguage?.name ?? null,
        stars: r.stargazerCount ?? 0, forks: r.forkCount ?? 0,
        openIssues: r.openIssues?.totalCount ?? 0, closedIssues: r.closedIssues?.totalCount ?? 0,
        openPrs: r.openPrs?.totalCount ?? 0, mergedPrs: r.mergedPrs?.totalCount ?? 0,
        commits30d: head?.history?.totalCount ?? 0,
        lastCommitAt: head?.committedDate ?? null, lastCommitMessage: head?.messageHeadline ?? null,
        ci: rollup === 'SUCCESS' ? 'passing' : rollup === 'FAILURE' || rollup === 'ERROR' ? 'failing' : rollup ? 'pending' : null,
        archived: !!r.isArchived, isPrivate: !!r.isPrivate,
        hasReadme: !!(r.readme?.id || r.readmeLower?.id), license: r.licenseInfo?.spdxId ?? null,
        release: r.latestRelease ? { tag: r.latestRelease.tagName, at: r.latestRelease.publishedAt } : null,
        milestone: ms ? { title: ms.title, dueOn: ms.dueOn ?? null, percent: Number(ms.progressPercentage) || 0 } : null,
      });
    }
    // No token: the public REST API still answers the basics (60 requests/hour per IP).
    const resp = await fetch(`https://api.github.com/repos/${slug}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (resp.status === 404) return { slug, url, ok: false, error: 'Repository not found, or it is private.', checkedAt };
    if (!resp.ok) return { slug, url, ok: false, error: `GitHub answered ${resp.status}. Try again later.`, checkedAt };
    const r: any = await resp.json();
    return deriveRepo({
      slug, url: r.html_url || url, ok: true, checkedAt,
      description: r.description ?? null, language: r.language ?? null,
      stars: r.stargazers_count ?? 0, forks: r.forks_count ?? 0, openIssues: r.open_issues_count ?? 0,
      lastCommitAt: r.pushed_at ?? null, archived: !!r.archived, isPrivate: !!r.private,
      hasReadme: true, license: r.license?.spdx_id ?? null, ci: null,
    });
  } catch {
    return { slug, url, ok: false, error: 'Couldn’t reach GitHub. Try again in a minute.', checkedAt };
  }
};

const REPO_STALE_MS = 6 * 60 * 60 * 1000;

/** Refreshes and stores stats for a project row. Silently does nothing before the migration runs. */
const refreshProjectRepo = async (supabase: any, row: any): Promise<RepoStats | null> => {
  const repoUrl = row?.repo_url || (parseGithubRepo(row?.project_url) ? row.project_url : '');
  if (!repoUrl) return null;
  const stats = await fetchRepoStats(repoUrl);
  try {
    await supabase.from('project_submissions')
      .update({ repo_stats: stats, repo_checked_at: stats.checkedAt, ...(row.repo_url ? {} : { repo_url: repoUrl }) })
      .eq('id', row.id);
  } catch { /* column missing until migration */ }
  return stats;
};

// ---------- /repo-tracker ----------------------------------------------------
// GET ?url=…          live check for the submit form (signed-in members only)
// GET ?ids=1,2,3      stored stats for approved projects; refreshes a few stale ones per call
const handler_repo_tracker: H = async (req, res) => {
  if (req.method !== 'GET') { sendError(res, 405, 'Method not allowed'); return; }
  const caller = await authCaller(req);
  if ('error' in caller) { sendError(res, 500, caller.error); return; }
  const { supabase, uid } = caller;
  const url = getStringParam(req.query?.url);
  if (url) {
    if (!uid) { sendError(res, 401, 'Sign in to check a repository'); return; }
    sendJson(res, 200, { repo: await fetchRepoStats(url) });
    return;
  }
  const ids = (getStringParam(req.query?.ids) || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!ids.length) { sendJson(res, 200, { repos: {} }); return; }
  const { data, error } = await supabase.from('project_submissions').select('*').in('id', ids);
  if (error) { sendJson(res, 200, { repos: {} }); return; }
  const rows = (data ?? []).filter((r: any) => String(r.status || '').toLowerCase() === 'approved');
  const out: Record<string, RepoStats | null> = {};
  let refreshBudget = 3; // keep well inside the 10 s function limit
  for (const r of rows) {
    const stale = !r.repo_checked_at || Date.now() - new Date(r.repo_checked_at).getTime() > REPO_STALE_MS;
    if (stale && refreshBudget > 0 && (r.repo_url || parseGithubRepo(r.project_url))) {
      refreshBudget--;
      out[String(r.id)] = await refreshProjectRepo(supabase, r);
    } else {
      out[String(r.id)] = r.repo_stats ?? null;
    }
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  sendJson(res, 200, { repos: out });
};

// ---------- /cron/repo-sync (Vercel Cron, daily) ----------------------------
const handler_cron_repo_sync: H = async (req, res) => {
  const secret = process.env.CRON_SECRET || '';
  if (!secret || getBearerToken(req.headers?.authorization) !== secret) { sendError(res, 401, 'Unauthorized'); return; }
  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey) { sendError(res, 500, 'Server not configured'); return; }
  const supabase = createServiceClient(url, serviceKey);
  const { data, error } = await supabase.from('project_submissions').select('*')
    .in('status', ['approved', 'Approved', 'APPROVED'])
    .order('repo_checked_at', { ascending: true, nullsFirst: true }).limit(12);
  if (error) { sendError(res, 500, 'Failed to load projects'); return; }
  let refreshed = 0;
  const started = Date.now();
  for (const r of data ?? []) {
    if (Date.now() - started > 8000) break;
    if (await refreshProjectRepo(supabase, r)) refreshed++;
  }
  try { await invalidateCache('cache:projects:approved'); await invalidateCache('cache:projects:approved:merged'); } catch { /* noop */ }
  sendJson(res, 200, { refreshed });
};

// ---------- /teams -----------------------------------------------------------
const TEAM_STATUSES = ['pending', 'approved', 'declined', 'left'];

const handler_teams: H = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') { sendError(res, 405, 'Method not allowed'); return; }
  const caller = await authCaller(req);
  if ('error' in caller) { sendError(res, 500, caller.error); return; }
  const { supabase, uid } = caller;
  const { data: me } = uid ? await supabase.from('users').select('*').eq('uid', uid).maybeSingle() : { data: null };
  const isAdmin = !!me?.is_admin;

  const loadProject = async (projectId: string) => {
    const { data } = await supabase.from('project_submissions').select('*').eq('id', projectId).maybeSingle();
    return data ?? null;
  };
  const loadTeam = async (projectId: string) => {
    const { data, error } = await supabase.from('team_members').select('*').eq('project_id', String(projectId));
    if (error) return { rows: [] as any[], missing: isMissingTableError(error) };
    return { rows: data ?? [], missing: false };
  };
  const headIdOf = (project: any, rows: any[]) =>
    rows.find((r) => r.role === 'head' && r.status === 'approved')?.user_id || project?.team_head_id || project?.user_id || null;

  if (req.method === 'GET') {
    // My teams and requests (dashboard)
    if (getStringParam(req.query?.mine)) {
      if (!uid) { sendError(res, 401, 'Sign in first'); return; }
      const { data: mine, error } = await supabase.from('team_members').select('*').eq('user_id', uid);
      if (error) { sendJson(res, 200, { teams: [], pendingForMe: 0, available: !isMissingTableError(error) }); return; }
      const projectIds = Array.from(new Set((mine ?? []).map((m: any) => m.project_id)));
      const { data: projects } = projectIds.length
        ? await supabase.from('project_submissions').select('*').in('id', projectIds)
        : { data: [] as any[] };
      const byId = new Map((projects ?? []).map((p: any) => [String(p.id), p]));
      const headOf = (mine ?? []).filter((m: any) => m.role === 'head' && m.status === 'approved').map((m: any) => m.project_id);
      const { count: pendingForMe } = headOf.length
        ? await supabase.from('team_members').select('*', { count: 'exact', head: true }).in('project_id', headOf).eq('status', 'pending')
        : { count: 0 };
      sendJson(res, 200, {
        available: true,
        pendingForMe: pendingForMe ?? 0,
        teams: (mine ?? []).filter((m: any) => m.status !== 'left').map((m: any) => {
          const p: any = byId.get(String(m.project_id));
          return {
            projectId: m.project_id, projectName: p?.project_name ?? p?.title ?? 'Project',
            projectStatus: p?.status ?? 'pending', role: m.role, status: m.status, teamRole: m.team_role ?? null,
            requestedAt: m.created_at, decidedAt: m.decided_at ?? null,
          };
        }),
      });
      return;
    }

    const projectId = getStringParam(req.query?.project);
    if (!projectId) { sendError(res, 400, 'project is required'); return; }
    const project = await loadProject(projectId);
    if (!project) { sendError(res, 404, 'Project not found'); return; }
    const approvedProject = String(project.status || '').toLowerCase() === 'approved';
    const { rows, missing } = await loadTeam(projectId);
    const headId = headIdOf(project, rows);
    const canManage = !!uid && (uid === headId || isAdmin);
    if (!approvedProject && !canManage && project.user_id !== uid) { sendError(res, 404, 'Project not found'); return; }

    const userIds = Array.from(new Set([...rows.map((r: any) => r.user_id), headId, project.owner_user_id].filter(Boolean)));
    const { data: users } = userIds.length ? await supabase.from('users').select('*').in('uid', userIds) : { data: [] as any[] };
    const userById = new Map((users ?? []).map((u: any) => [String(u.uid), u]));
    // Team pages are public: names are redacted unless the member opted in, except for the head/admins.
    const personOf = (userId: string, full = false) => {
      const u: any = userById.get(String(userId));
      return {
        userId: canManage || full ? userId : undefined,
        name: u ? (canManage || full ? String(u.full_name || '').trim() || 'Member' : publicNameOf(u)) : 'Member',
        role: u?.specialization || null,
        memberId: u?.member_id || null,
        avatarUrl: discordAvatarOf(u),
        discordUsername: canManage ? u?.discord_username || null : undefined,
        skills: canManage && Array.isArray(u?.skills) ? u.skills.slice(0, 6).map((s: any) => s?.name).filter(Boolean) : undefined,
      };
    };
    const members = rows.filter((r: any) => r.status === 'approved');
    if (headId && !members.some((m: any) => m.user_id === headId)) members.unshift({ user_id: headId, role: 'head', status: 'approved' });
    const mine = uid ? rows.find((r: any) => r.user_id === uid) : null;
    const ownerUser: any = project.owner_user_id ? userById.get(String(project.owner_user_id)) : null;

    sendJson(res, 200, {
      available: !missing,
      project: {
        id: project.id, name: project.project_name ?? project.title ?? '', status: project.status ?? 'pending',
        url: normalizeUrl(project.project_url ?? project.url ?? ''), repoUrl: project.repo_url ?? null,
        description: project.description ?? '', stage: project.stage ?? null, projType: project.proj_type ?? null,
        repo: project.repo_stats ?? null,
      },
      owner: project.owner_type === 'member' && ownerUser
        ? { type: 'member', name: canManage ? ownerUser.full_name : publicNameOf(ownerUser), userId: canManage ? ownerUser.uid : undefined }
        : project.owner_name ? { type: project.owner_type || 'org', name: project.owner_name } : null,
      members: members.map((m: any) => ({ ...personOf(m.user_id), isHead: m.user_id === headId, teamRole: m.team_role ?? null })),
      me: uid ? { status: mine?.status ?? (uid === headId ? 'approved' : null), isHead: uid === headId, canManage,
        approvedMember: String(me?.status || '').toLowerCase() === 'approved' || isAdmin } : null,
      requests: canManage
        ? rows.filter((r: any) => r.status === 'pending').map((r: any) => ({
            id: r.id, message: r.message ?? '', teamRole: r.team_role ?? null, createdAt: r.created_at, person: personOf(r.user_id, true),
          }))
        : undefined,
    });
    return;
  }

  // ----- POST actions -----
  if (!uid) { sendError(res, 401, 'Sign in first'); return; }
  const body = getBody(req);
  const action = typeof body.action === 'string' ? body.action : '';
  const projectId = typeof body.projectId === 'string' || typeof body.projectId === 'number' ? String(body.projectId) : '';
  if (!projectId) { sendError(res, 400, 'projectId is required'); return; }
  const project = await loadProject(projectId);
  if (!project) { sendError(res, 404, 'Project not found'); return; }
  const { rows, missing } = await loadTeam(projectId);
  if (missing) { sendError(res, 503, 'Teams aren’t switched on yet. An admin needs to run the latest database migration.'); return; }
  const headId = headIdOf(project, rows);
  const canManage = uid === headId || isAdmin;
  const now = new Date().toISOString();

  if (action === 'join') {
    if (String(project.status || '').toLowerCase() !== 'approved') { sendError(res, 400, 'This project isn’t open for joining yet.'); return; }
    if (!isAdmin && String(me?.status || '').toLowerCase() !== 'approved') { sendError(res, 403, 'You can join teams once your membership is approved.'); return; }
    if (uid === headId) { sendError(res, 400, 'You already lead this team.'); return; }
    const existing = rows.find((r: any) => r.user_id === uid);
    if (existing?.status === 'approved') { sendError(res, 400, 'You’re already on this team.'); return; }
    if (existing?.status === 'pending') { sendError(res, 400, 'Your request is already waiting for the team head.'); return; }
    const payload = {
      project_id: projectId, user_id: uid, role: 'member', status: 'pending',
      message: typeof body.message === 'string' ? body.message.trim().slice(0, 500) || null : null,
      team_role: typeof body.teamRole === 'string' ? body.teamRole.trim().slice(0, 80) || null : null,
      created_at: now, decided_at: null,
    };
    const { error } = existing
      ? await supabase.from('team_members').update(payload).eq('id', existing.id)
      : await supabase.from('team_members').insert(payload);
    if (error) { sendError(res, 500, 'Couldn’t send your request'); return; }
    sendJson(res, 200, { status: 'pending' });
    return;
  }

  if (action === 'cancel' || action === 'leave') {
    if (uid === headId) { sendError(res, 400, 'Hand the team head role to someone else before leaving.'); return; }
    const existing = rows.find((r: any) => r.user_id === uid);
    if (!existing) { sendError(res, 404, 'You’re not on this team'); return; }
    const { error } = await supabase.from('team_members').update({ status: 'left', decided_at: now }).eq('id', existing.id);
    if (error) { sendError(res, 500, 'Couldn’t update your membership'); return; }
    sendJson(res, 200, { status: 'left' });
    return;
  }

  if (!canManage) { sendError(res, 403, 'Only the team head or an admin can do that.'); return; }

  if (action === 'decide') {
    const requestId = typeof body.requestId === 'string' ? body.requestId : '';
    const decision = body.decision === 'approve' ? 'approved' : body.decision === 'decline' ? 'declined' : '';
    const target = rows.find((r: any) => r.id === requestId);
    if (!target || !decision) { sendError(res, 400, 'requestId and decision (approve|decline) are required'); return; }
    const { error } = await supabase.from('team_members').update({ status: decision, decided_at: now }).eq('id', requestId);
    if (error) { sendError(res, 500, 'Couldn’t save the decision'); return; }
    sendJson(res, 200, { status: decision });
    return;
  }

  if (action === 'remove') {
    const userId = typeof body.userId === 'string' ? body.userId : '';
    if (!userId || userId === headId) { sendError(res, 400, 'Pick a member to remove (not the head).'); return; }
    const { error } = await supabase.from('team_members').update({ status: 'left', decided_at: now }).eq('project_id', projectId).eq('user_id', userId);
    if (error) { sendError(res, 500, 'Couldn’t remove that member'); return; }
    sendJson(res, 200, { status: 'left' });
    return;
  }

  if (action === 'transfer-head') {
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const target = rows.find((r: any) => r.user_id === userId && r.status === 'approved');
    if (!target) { sendError(res, 400, 'The new head must already be on the team.'); return; }
    await supabase.from('team_members').update({ role: 'member' }).eq('project_id', projectId).eq('role', 'head');
    if (headId && !rows.some((r: any) => r.user_id === headId)) {
      await supabase.from('team_members').insert({ project_id: projectId, user_id: headId, role: 'member', status: 'approved', decided_at: now });
    }
    const { error } = await supabase.from('team_members').update({ role: 'head' }).eq('id', target.id);
    if (error) { sendError(res, 500, 'Couldn’t hand over the head role'); return; }
    try { await supabase.from('project_submissions').update({ team_head_id: userId }).eq('id', projectId); } catch { /* noop */ }
    sendJson(res, 200, { headId: userId });
    return;
  }

  if (action === 'set-owner') {
    const ownerType = body.ownerType === 'member' ? 'member' : body.ownerType === 'org' ? 'org' : '';
    if (!ownerType) { sendError(res, 400, 'ownerType must be member or org'); return; }
    const update: Record<string, any> = { owner_type: ownerType };
    if (ownerType === 'member') {
      const userId = typeof body.ownerUserId === 'string' ? body.ownerUserId : '';
      const onTeam = userId === headId || rows.some((r: any) => r.user_id === userId && r.status === 'approved');
      if (!onTeam) { sendError(res, 400, 'Pick an owner from the team.'); return; }
      update.owner_user_id = userId; update.owner_name = null;
    } else {
      const name = typeof body.ownerName === 'string' ? body.ownerName.trim().slice(0, 120) : '';
      if (!name) { sendError(res, 400, 'Enter the organisation or agency name.'); return; }
      update.owner_name = name; update.owner_user_id = null;
    }
    const { error } = await supabase.from('project_submissions').update(update).eq('id', projectId);
    if (error) { sendError(res, isMissingColumnError(error) ? 503 : 500, 'Couldn’t save the owner'); return; }
    try { await invalidateCache('cache:projects:approved'); await invalidateCache('cache:projects:approved:merged'); } catch { /* noop */ }
    sendJson(res, 200, { owner: update });
    return;
  }

  sendError(res, 400, `Unknown action. Use one of: join, cancel, leave, decide, remove, transfer-head, set-owner (statuses: ${TEAM_STATUSES.join(', ')})`);
};


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
  const links = sanitizeLinks(body.links);
  if (links) updates.links = links;
  if (typeof body.secondarySpecialization === 'string') {
    updates.secondary_specialization = body.secondarySpecialization.trim().slice(0, 100) || null;
  }
  if (typeof body.showInDirectory === 'boolean') updates.show_in_directory = body.showInDirectory;
  if (typeof body.showFullName === 'boolean') updates.show_full_name = body.showFullName;
  // Right to erasure: the member asks, an admin completes it (approved projects may need a new owner first).
  if (body.requestDeletion === true) { updates.deletion_requested_at = new Date().toISOString(); updates.show_in_directory = false; }
  if (body.requestDeletion === false) updates.deletion_requested_at = null;
  updates.auth_provider = 'google';

  if (typeof updates.discord_username === 'string' && updates.discord_username.trim()) {
    const { data: unameDup } = await supabase
      .from('users').select('uid').eq('discord_username', updates.discord_username).maybeSingle();
    if (unameDup && String(unameDup.uid) !== String(uid)) {
      sendError(res, 409, `Discord username "${updates.discord_username}" is already used by another member. Please use a different Discord username.`);
      return;
    }
  }

  const { data: existingUser } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();

  // Data Privacy Act consent. Every change is also written to consent_log (the ROPA evidence trail).
  let consentEvent: { action: 'granted' | 'updated' | 'withdrawn'; purposes: string[] } | null = null;
  const nowIso = new Date().toISOString();
  if (body.consent && typeof body.consent === 'object') {
    if (body.consent.withdraw === true) {
      updates.consent_at = null; updates.consent_purposes = []; updates.show_in_directory = false; updates.show_full_name = false;
      consentEvent = { action: 'withdrawn', purposes: [] };
    } else {
      const purposes: string[] = Array.isArray(body.consent.purposes)
        ? Array.from(new Set(body.consent.purposes.filter((p: unknown) => typeof p === 'string' && (CONSENT_PURPOSES as readonly string[]).includes(p as string))))
        : [];
      if (!REQUIRED_PURPOSES.every((p) => purposes.includes(p))) {
        sendError(res, 400, 'Consent to membership and project matching is needed to join.');
        return;
      }
      updates.consent_version = CONSENT_VERSION; updates.consent_at = nowIso; updates.consent_purposes = purposes;
      updates.show_in_directory = purposes.includes('directory');
      consentEvent = { action: existingUser?.consent_at ? 'updated' : 'granted', purposes };
    }
  } else if (typeof body.showInDirectory === 'boolean' && existingUser?.consent_at) {
    // The directory switch is the "directory" purpose; keep the consent record in step with it.
    const current: string[] = Array.isArray(existingUser.consent_purposes) ? existingUser.consent_purposes : [];
    const next = body.showInDirectory ? Array.from(new Set([...current, 'directory'])) : current.filter((p) => p !== 'directory');
    if (next.length !== current.length) {
      updates.consent_purposes = next; updates.consent_version = CONSENT_VERSION; updates.consent_at = nowIso;
      consentEvent = { action: 'updated', purposes: next };
    }
  }

  // The name on an approved member's Volunteer Card is what /verify vouches for; only admins change it.
  if (existingUser && String(existingUser.status || '').toLowerCase() === 'approved') delete updates.full_name;
  if (existingUser) {
    let { data: updatedRows, error: updateError } = await supabase
      .from('users').update(updates).eq('uid', uid).select('*');
    // Before a migration runs, save everything else instead of failing the whole profile.
    if (updateError && isMissingColumnError(updateError)) {
      for (const k of ['links', 'secondary_specialization', 'show_in_directory', 'show_full_name', 'consent_version', 'consent_at', 'consent_purposes', 'deletion_requested_at']) delete updates[k];
      consentEvent = null;
      ({ data: updatedRows, error: updateError } = await supabase.from('users').update(updates).eq('uid', uid).select('*'));
    }
    if (updateError) { sendError(res, 500, 'Failed to update profile'); return; }
    const updated = Array.isArray(updatedRows) ? updatedRows[0] : null;
    if (consentEvent) {
      try {
        await supabase.from('consent_log').insert({
          user_id: uid, action: consentEvent.action, consent_version: CONSENT_VERSION, purposes: consentEvent.purposes,
          user_agent: String(req.headers?.['user-agent'] || '').slice(0, 300) || null,
        });
      } catch { /* table missing until migration */ }
    }
    if (consentEvent || 'show_in_directory' in updates || 'show_full_name' in updates) {
      try { await invalidateCache('cache:volunteers:directory:v2'); } catch { /* noop */ }
    }
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
const projectExtrasOf = (row: any) => ({
  repoUrl: row.repo_url ?? undefined, stage: row.stage ?? undefined,
  ownerType: row.owner_type ?? undefined, ownerName: row.owner_name ?? undefined,
  adminNote: row.admin_note ?? undefined, reviewedAt: row.reviewed_at ?? undefined,
  repo: row.repo_stats ?? undefined,
});
const mapSubmissionRow = (row: any, submittedBy?: { fullName: string; email: string }) => ({
  id: row.id, userId: row.user_id,
  projectName: row.project_name ?? '', projectUrl: row.project_url ?? '',
  description: row.description ?? '',
  projType: row.proj_type ?? row.tech_stack ?? undefined,
  status: row.status ?? 'pending', createdAt: row.created_at, submittedBy,
  ...projectExtrasOf(row),
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
    const { count: total } = await adminSup.from('users').select('*', { count: 'exact', head: true }).not('full_name', 'eq', '').or('specialization.neq."",status.eq.Approved,status.eq.approved');
    const { count: pending } = await adminSup.from('users').select('*', { count: 'exact', head: true })
      .in('status', ['Pending', 'pending', 'PENDING']).not('full_name', 'eq', '').not('specialization', 'eq', '');
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
    let query: any = adminSup.from('users').select('*', { count: 'exact' }).eq('is_admin', false).not('full_name', 'eq', '').or('specialization.neq."",status.eq.Approved,status.eq.approved');
    if (statusFilter && statusFilter !== 'All') {
      const variants = Array.from(new Set([statusFilter, statusFilter.toLowerCase(), statusFilter.toUpperCase(),
        statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1).toLowerCase()]));
      query = query.in('status', variants);
    }
    if (roleFilter && roleFilter !== 'All') query = query.eq('specialization', roleFilter);
    if (searchRaw && searchRaw.trim()) {
      const safe = searchRaw.trim().replace(/[%_,()*:"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64);
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
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
    const reviewFields = { admin_note: note || null, reviewed_at: new Date().toISOString() };
    const updateWithReview = async (fields: Record<string, any>) => {
      let r = await adminSup.from('project_submissions').update({ ...fields, ...reviewFields }).eq('id', id);
      if (r.error && isMissingColumnError(r.error)) r = await adminSup.from('project_submissions').update(fields).eq('id', id);
      return r;
    };
    if (action === 'approve') {
      const { error: approveError } = await updateWithReview({ status: 'approved' });
      if (approveError) { sendError(res, 500, 'Failed to approve submission'); return; }
      await invalidateProjectCache();
      sendJson(res, 200, { message: 'Approved submission' });
      return;
    }
    if (action === 'reject') {
      if (!note) { sendError(res, 400, 'Add a short note so the submitter knows what to change.'); return; }
      const { error: rejectError } = await updateWithReview({ status: 'rejected' });
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
      if (typeof body.repo_url === 'string') updateFields.repo_url = body.repo_url.trim() || null;
      if (typeof body.stage === 'string') updateFields.stage = body.stage.trim() || null;
      if (typeof body.admin_note === 'string') updateFields.admin_note = body.admin_note.trim() || null;
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

  if (req.method === 'GET' && resource === 'consent') {
    if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminSup.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    if (authError || !callerUid) { sendError(res, 401, 'Invalid token'); return; }
    const adminCheck = await assertAdmin(adminSup, callerUid, authData?.user?.email ?? undefined);
    if (!adminCheck.ok) { sendError(res, 403, adminCheck.error); return; }
    const { data: users, error: usersError } = await adminSup.from('users')
      .select('uid, full_name, email, member_id, status, created_at, consent_version, consent_at, consent_purposes, show_in_directory, show_full_name, deletion_requested_at')
      .eq('is_admin', false).not('full_name', 'eq', '').order('created_at', { ascending: true }).limit(5000);
    if (usersError) {
      sendError(res, isMissingColumnError(usersError) ? 503 : 500,
        isMissingColumnError(usersError) ? 'Run the 20261105 migration to start recording consent.' : 'Failed to load consent records');
      return;
    }
    const { data: log } = await adminSup.from('consent_log').select('*').order('created_at', { ascending: false }).limit(5000);
    sendJson(res, 200, { version: CONSENT_VERSION, members: users ?? [], log: log ?? [] });
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
  repoUrl: row.repo_url ?? undefined, stage: row.stage ?? undefined,
  ownerName: row.owner_type === 'org' ? row.owner_name ?? undefined : undefined,
  repo: row.repo_stats ?? undefined,
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

const PUBLIC_PROJECT_COLUMNS = 'id, project_name, project_url, description, proj_type, status, created_at, repo_url, stage, owner_type, owner_name, repo_stats';

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
    // Public list: only public columns (anon can't read submitter ids, review notes or team data).
    let result = await client
      .from('project_submissions').select(PUBLIC_PROJECT_COLUMNS)
      .in('status', ['approved', 'Approved', 'APPROVED'])
      .order('created_at', { ascending: false }).limit(100);
    if (result.error &&
        typeof (result.error as any)?.message === 'string' &&
        String((result.error as any).message).toLowerCase().includes('created_at')) {
      result = await client
        .from('project_submissions').select(PUBLIC_PROJECT_COLUMNS)
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
  // Retry with the anon key only if the service key failed; an empty list is a valid answer.
  if (result.error && fallbackKey) {
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
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 4000) : '';
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
  if (projectName.length > 160) { sendError(res, 400, 'Keep the project name under 160 characters.'); return; }
  if (!safeHttpUrl(projectUrl)) { sendError(res, 400, 'Use a full web link (https://…) for the project.'); return; }
  // Repo: given explicitly, or the main link if that is already a GitHub repo. Must exist and be public.
  const repoRaw = typeof body.repo_url === 'string' ? body.repo_url.trim() : typeof body.repoUrl === 'string' ? body.repoUrl.trim() : '';
  const repoUrl = repoRaw || (parseGithubRepo(projectUrl) ? projectUrl : '');
  let repoStats: RepoStats | null = null;
  if (repoUrl) {
    repoStats = await fetchRepoStats(repoUrl);
    if (!repoStats.ok) { sendError(res, 400, repoStats.error || 'Couldn’t read that repository.'); return; }
  }
  const STAGES = ['idea', 'building', 'beta', 'live'];
  const stage = typeof body.stage === 'string' && STAGES.includes(body.stage) ? body.stage : null;
  const ownerType = body.owner_type === 'org' || body.ownerType === 'org' ? 'org' : 'member';
  const ownerNameRaw = typeof body.owner_name === 'string' ? body.owner_name : typeof body.ownerName === 'string' ? body.ownerName : '';
  const extras: Record<string, any> = {
    repo_url: repoStats ? repoStats.url : null, stage, team_head_id: uid,
    owner_type: ownerType, owner_name: ownerType === 'org' ? ownerNameRaw.trim().slice(0, 120) || null : null,
    owner_user_id: ownerType === 'member' ? uid : null,
    repo_stats: repoStats, repo_checked_at: repoStats?.checkedAt ?? null,
  };
  const supabaseDb = createServiceClient(supabaseUrl, serviceRoleKey);
  let r = await tryInsertSubmission(supabaseDb, {
    user_id: uid, project_name: projectName, project_url: projectUrl,
    description, proj_type: projType || null, status: 'pending', ...extras,
  });
  if (r.error && isMissingColumnError(r.error)) {
    r = await tryInsertSubmission(supabaseDb, {
      user_id: uid, project_name: projectName, project_url: projectUrl,
      description, proj_type: projType || null, status: 'pending',
    });
  }
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
    sendError(res, 500, 'Failed to submit project. Please try again.');
    return;
  }
  // The submitter leads the project's team.
  try {
    await supabaseDb.from('team_members').insert({
      project_id: String(data.id), user_id: uid, role: 'head', status: 'approved', decided_at: new Date().toISOString(),
    });
  } catch { /* table missing until migration */ }
  try { await invalidateCache('cache:admin:stats'); } catch { /* noop */ }
  sendJson(res, 200, { message: 'Submitted successfully!', submissionId: data.id, repo: repoStats });
};

// ---------- /my-project-submissions (api/_handlers/my-project-submissions.ts)
const mapMySubmissionRow = (row: any) => ({
  id: row.id, userId: row.user_id,
  projectName: row.project_name ?? '', projectUrl: row.project_url ?? '',
  description: row.description ?? '',
  projType: row.proj_type ?? row.tech_stack ?? undefined,
  status: row.status ?? 'pending', createdAt: row.created_at,
  ...projectExtrasOf(row),
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
  callType: row.call_type ?? 'people', location: row.location ?? undefined, neededBy: row.needed_by ?? undefined,
  commitment: row.commitment ?? undefined, workMode: row.work_mode ?? undefined, goodFirst: row.good_first === true,
  status: row.status ?? 'open', createdAt: row.created_at, postedBy,
});

const CALL_TYPES = ['people', 'venue', 'equipment', 'funding', 'transport', 'food', 'printing', 'other'];
const callExtrasFrom = (body: any) => {
  const out: Record<string, any> = {};
  const t = typeof body.call_type === 'string' ? body.call_type : typeof body.callType === 'string' ? body.callType : '';
  if (t && CALL_TYPES.includes(t)) out.call_type = t;
  if (typeof body.location === 'string') out.location = body.location.trim().slice(0, 160) || null;
  const nb = typeof body.needed_by === 'string' ? body.needed_by : typeof body.neededBy === 'string' ? body.neededBy : undefined;
  if (nb !== undefined) out.needed_by = /^\d{4}-\d{2}-\d{2}$/.test(nb) ? nb : null;
  if (typeof body.commitment === 'string') out.commitment = ['one-off', 'few-hours', 'weekly', 'ongoing'].includes(body.commitment) ? body.commitment : null;
  const wm = typeof body.work_mode === 'string' ? body.work_mode : typeof body.workMode === 'string' ? body.workMode : undefined;
  if (wm !== undefined) out.work_mode = ['remote', 'onsite', 'hybrid'].includes(wm) ? wm : null;
  const gf = typeof body.good_first === 'boolean' ? body.good_first : typeof body.goodFirst === 'boolean' ? body.goodFirst : undefined;
  if (gf !== undefined) out.good_first = gf;
  return out;
};

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
      // Emails stay with admins; members see who posted, and reach them through the contact field.
      if (usersData) for (const u of usersData) userMap.set(u.uid, { fullName: u.full_name ?? '', email: isAdmin ? u.email ?? '' : '' });
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
    if (typeof body.title === 'string') updateFields.title = body.title.trim().slice(0, 160);
    const urlIn = typeof body.projectUrl === 'string' ? body.projectUrl : typeof body.project_url === 'string' ? body.project_url : undefined;
    if (urlIn !== undefined) {
      const clean = urlIn.trim() ? safeHttpUrl(urlIn.trim()) : '';
      if (urlIn.trim() && !clean) { sendError(res, 400, 'Use a full web link (https://…) for the project.'); return; }
      updateFields.project_url = clean;
    }
    if (typeof body.description === 'string') updateFields.description = body.description.trim().slice(0, 4000);
    if (typeof body.roles_needed === 'string') updateFields.roles_needed = body.roles_needed.trim().slice(0, 500) || null;
    if (typeof body.rolesNeeded === 'string') updateFields.roles_needed = body.rolesNeeded.trim().slice(0, 500) || null;
    if (typeof body.contact === 'string') updateFields.contact = body.contact.trim().slice(0, 200) || null;
    if (typeof body.status === 'string' && ['open', 'closed'].includes(body.status.toLowerCase())) {
      updateFields.status = body.status.toLowerCase();
    }
    const extras = callExtrasFrom(body);
    if (Object.keys(updateFields).length === 0 && Object.keys(extras).length === 0) { sendError(res, 400, 'No fields to update'); return; }
    let { error: updateError } = await supabase.from('volunteer_calls').update({ ...updateFields, ...extras }).eq('id', id);
    if (updateError && isMissingColumnError(updateError) && Object.keys(updateFields).length) {
      ({ error: updateError } = await supabase.from('volunteer_calls').update(updateFields).eq('id', id));
    }
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
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : '';
  const projectUrlRaw = typeof body.project_url === 'string' ? body.project_url.trim() :
    typeof body.projectUrl === 'string' ? body.projectUrl.trim() : '';
  const projectUrl = safeHttpUrl(projectUrlRaw);
  if (projectUrlRaw && !projectUrl) { sendError(res, 400, 'Use a full web link (https://…) for the project.'); return; }
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 4000) : '';
  const rolesNeeded = typeof body.roles_needed === 'string' ? body.roles_needed.trim().slice(0, 500) :
    typeof body.rolesNeeded === 'string' ? body.rolesNeeded.trim().slice(0, 500) : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, 200) : '';
  const extras = callExtrasFrom(body);
  const isPeople = (extras.call_type ?? 'people') === 'people';
  // A venue or equipment request may not have a project link yet; a call for people always does.
  if (!title || !description || (isPeople && !projectUrl)) {
    sendError(res, 400, isPeople ? 'title, project_url, and description are required' : 'title and description are required'); return;
  }
  const basePayload: Record<string, any> = {
    user_id: uid, title, project_url: projectUrl, description,
    roles_needed: isPeople ? rolesNeeded || null : null, contact: contact || null, status: 'open',
  };
  let { data, error } = await supabase.from('volunteer_calls').insert([{ ...basePayload, ...extras }]).select('id').maybeSingle();
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase.from('volunteer_calls').insert([basePayload]).select('id').maybeSingle());
  }
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
    sendError(res, 500, 'Failed to post. Please try again.');
    return;
  }
  sendJson(res, 200, { message: 'Posted successfully!', id: data.id });
};

// ---------- /verify (api/_handlers/verify.ts) -------------------------------
const isSafeMemberId = (value: string) => /^BGPH-\d{4}-\d{3,4}$/i.test(value);
const normalizeLookupId = (raw: string) => raw.trim().toUpperCase();

const handler_verify: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') { sendError(res, 405, 'Method not allowed'); return; }
  const { url: supabaseUrl, anonKey, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl) { sendError(res, 500, 'Server not configured'); return; }
  const queryId = getStringParam(req.query?.id ?? req.query?.memberId);
  const bodyId = getStringParam(req.body?.id ?? req.body?.memberId);
  const lookupRaw = queryId ?? bodyId;
  if (!lookupRaw || !lookupRaw.trim()) { sendError(res, 400, 'Missing id (memberId)'); return; }
  const lookup = normalizeLookupId(lookupRaw);
  
  const token = getBearerToken(req.headers?.authorization);
  let isAdminCaller = false;
  let callerUid = '';
  const dbClient = serviceKey
    ? createServiceClient(supabaseUrl, serviceKey)
    : createAnonClient(supabaseUrl, anonKey);

  if (token && serviceKey) {
    try {
      const { data: authData } = await dbClient.auth.getUser(token);
      if (authData?.user) {
        callerUid = authData.user.id;
        const { data: callerRow } = await dbClient
          .from('users').select('is_admin').eq('uid', callerUid).maybeSingle();
        isAdminCaller = !!callerRow?.is_admin;
      }
    } catch { isAdminCaller = false; }
  }

  const cleanLookup = lookupRaw.trim();
  const lookupUpper = cleanLookup.toUpperCase();
  const exactMemberId = lookupUpper.startsWith('BGPH-') ? lookupUpper : `BGPH-${lookupUpper}`;
  // Only a full member ID (BGPH-2026-001) or a uid is accepted. Anything else is never put in a query,
  // so a visitor can't add their own filters (e.g. ",email.eq.someone@x") or enumerate members.
  if (!isSafeMemberId(exactMemberId) && !isUuid(cleanLookup)) { sendError(res, 404, 'Not found'); return; }

  let row: any | null = null;

  const { data: memberData } = await dbClient
    .from('users')
    .select('*')
    .eq('member_id', isSafeMemberId(exactMemberId) ? exactMemberId : '__none__')
    .maybeSingle();

  row = memberData ?? null;

  if (!row && isUuid(lookupRaw.trim())) {
    const { data: uidData } = await dbClient
      .from('users')
      .select('*')
      .eq('uid', lookupRaw.trim()).maybeSingle();
    row = uidData ?? null;
  }

  if (!row) { sendError(res, 404, 'Not found'); return; }

  const rawStatus = String(row.status || 'Pending').trim();
  const statusNormalized = row.is_admin
    ? 'Approved'
    : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

  const responsePayload: Record<string, any> = {
    memberId: row.member_id ?? null,
    // Public card: redacted unless the member opted in. The member themself and admins see it in full.
    fullName: isAdminCaller || (callerUid && callerUid === row.uid) ? row.full_name ?? '' : publicNameOf(row),
    nameRedacted: !(isAdminCaller || (callerUid && callerUid === row.uid) || row.show_full_name === true),
    specialization: row.specialization ?? '',
    secondarySpecialization: row.secondary_specialization ?? null,
    role: row.role ?? 'Member',
    status: statusNormalized,
    yearJoined: row.year_joined ?? null,
  };

  if ((isAdminCaller || (callerUid && callerUid === row.uid)) && row.discord_username && String(row.discord_username).trim()) {
    responsePayload.discordUsername = String(row.discord_username).trim();
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
    const callbackUrl = (process.env.DISCORD_CALLBACK_URL || '').trim();
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
        // bettygo's /auth/login is GET-only. Always tell it where to send the browser back:
        // the configured callback, else this site's own /discord-callback. If bettygo rejects
        // that address (not in its allowlist), retry without it and let bettygo use its default.
        const origin = String(req.headers?.origin || '').replace(/\/$/, '');
        const redirectUri = callbackUrl || (origin ? `${origin}/discord-callback` : '');
        const loginUrl = (withRedirect: boolean) => {
          const params = new URLSearchParams({ user_id: uid as string });
          if (withRedirect && redirectUri) params.set('redirect_uri', redirectUri);
          return `${bettygoBaseUrl}/auth/login?${params.toString()}`;
        };
        let bettygoRes = await fetch(loginUrl(true), { headers: { 'X-Api-Key': bettygoKey } });
        if (bettygoRes.status === 400 && redirectUri) {
          bettygoRes = await fetch(loginUrl(false), { headers: { 'X-Api-Key': bettygoKey } });
        }
        if (!bettygoRes.ok) {
          const bt = await bettygoRes.text().catch(() => '');
          let bMsg = '';
          try {
            const bj = JSON.parse(bt);
            bMsg = String(bj?.message || bj?.error || bj?.msg || bt || '').slice(0, 300);
          } catch {
            bMsg = bt.slice(0, 300);
          }
          sendJson(res, 502, {
            error: 'Failed to initiate Discord OAuth',
            upstream_status: bettygoRes.status,
            upstream_message: bMsg || null,
          });
          return;
        }
        const d = await bettygoRes.json();
        const oauthUrl: string = String(d.url || '');
        sendJson(res, 200, { url: oauthUrl });
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
          .from('users').select('discord_id, discord_username').eq('uid', uid).maybeSingle();

        // A Discord ID arriving from the browser must carry bettygo's signature over
        // {ts}.{uid}.{discordId}.{username}; otherwise anyone could edit the callback URL
        // and claim another guild member's account.
        if (discordIdFromBody) {
          const ts = typeof body.ts === 'string' ? body.ts : '';
          const sig = typeof body.sig === 'string' ? body.sig.toLowerCase() : '';
          const rawUsername = typeof body.discord_username === 'string' ? body.discord_username : '';
          const age = Date.now() - Number(ts);
          const expected = createHmac('sha256', bettygoKey)
            .update(`${ts}.${uid}.${discordIdFromBody}.${rawUsername}`)
            .digest('hex');
          const valid =
            /^\d+$/.test(ts) && age >= 0 && age <= 10 * 60 * 1000 &&
            sig.length === expected.length &&
            timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
          if (!valid) {
            sendError(res, 400, 'This Discord link could not be verified or has expired. Please connect Discord again.');
            return;
          }
        }
        const discordId = discordIdFromBody ?? userData?.discord_id;
        if (!discordId) { sendJson(res, 200, { connected: false }); return; }

        if (discordId && discordId !== (userData?.discord_id ?? null)) {
          const { data: idDup } = await supabase
            .from('users').select('uid, discord_username').eq('discord_id', discordId).maybeSingle();
          if (idDup && String(idDup.uid) !== String(uid)) {
            const owner = idDup.discord_username ? ` (${idDup.discord_username})` : '';
            sendError(res, 409, `This Discord account is already linked to another member${owner}. Please use a different Discord account.`);
            return;
          }
        }

        let discordUsername = discordUsernameFromBody ?? null;
        let discordDisplayName = discordDisplayNameFromBody ?? null;
        let discordAvatar = discordAvatarFromBody ?? null;
        if (!discordUsername) {
          const profile = await resolveDiscordProfile(discordId, discordBotToken);
          if (profile) { discordUsername = profile.username; discordDisplayName = profile.displayName; discordAvatar = profile.avatar; }
        }

        if (discordUsername && discordUsername !== (userData?.discord_username ?? null)) {
          const { data: unameDup } = await supabase
            .from('users').select('uid, discord_id').eq('discord_username', discordUsername).maybeSingle();
          if (unameDup && String(unameDup.uid) !== String(uid)) {
            sendError(res, 409, `Discord username "${discordUsername}" is already used by another member. Please use a different Discord username.`);
            return;
          }
        }

        const bettygoRes = await fetch(`${bettygoBaseUrl}/users/${discordId}/discord`, { headers: { 'X-Api-Key': bettygoKey } });
        if (!bettygoRes.ok) { sendJson(res, 200, { connected: false }); return; }
        const { verified } = await bettygoRes.json();
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

// Public Volunteers directory. Approved members only, and only what their public card already
// shows (name, role, member ID, year) plus their featured skills and Discord avatar. No emails.
const handler_volunteers: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
  if (req.method !== 'GET') { sendError(res, 405, 'Method not allowed'); return; }
  const cacheKey = 'cache:volunteers:directory:v2';
  try { const cached = await getCache<any>(cacheKey); if (cached) { sendJson(res, 200, cached); return; } }
  catch { /* noop */ }
  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) { sendError(res, 500, 'Server not configured'); return; }
  const supabase = createServiceClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('status', 'Approved')
    .not('member_id', 'is', null)
    .order('full_name', { ascending: true })
    .limit(1000);
  if (error) { sendError(res, 500, 'Failed to load volunteers'); return; }
  // Members can hide themselves; names are redacted ("John K****") unless they opt in to their full name.
  const volunteers = (data ?? []).filter((r: any) => r.show_in_directory !== false).map((r: any) => {
    const skills: { name: string; featured?: boolean }[] = Array.isArray(r.skills) ? r.skills : [];
    const ordered = [...skills.filter((s) => s?.featured), ...skills.filter((s) => !s?.featured)];
    return {
      name: publicNameOf(r),
      role: r.specialization || null,
      secondaryRole: r.secondary_specialization || null,
      memberId: r.member_id,
      yearJoined: typeof r.year_joined === 'number' ? r.year_joined : null,
      isAdmin: !!r.is_admin,
      skills: ordered.map((s) => String(s?.name || '')).filter(Boolean).slice(0, 4),
      skillCount: skills.length,
      avatarUrl: discordAvatarOf(r),
    };
  });
  const payload = { volunteers, count: volunteers.length };
  try { await setCache(cacheKey, payload, 300); } catch { /* noop */ }
  sendJson(res, 200, payload);
};

type HandlerKey =
  | '/me' | '/admin' | '/projects' | '/submit-project' | '/my-project-submissions'
  | '/volunteer-calls' | '/verify' | '/discord' | '/discord-username-taken' | '/contribution-scores' | '/volunteers'
  | '/repo-tracker' | '/teams' | '/cron/repo-sync';

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
  '/volunteers': handler_volunteers,
  '/repo-tracker': handler_repo_tracker,
  '/teams': handler_teams,
  '/cron/repo-sync': handler_cron_repo_sync,
};

const callHandler = async (key: HandlerKey, req: any, res: any) => {
  const fn = HANDLERS[key];
  if (!fn) { sendError(res, 500, `Handler ${key} not registered`); return; }
  try { await fn(req, res); }
  catch (err) {
    console.error('[API][handler-error]', { key, error: err });
    sendError(res, 500, 'Internal server error');
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
      if (pathname.startsWith('/verify/')) {
        const idFromPath = pathname.slice('/verify/'.length).trim();
        if (idFromPath) {
          if (!req.query) req.query = {};
          if (!req.query.id) req.query.id = idFromPath;
          if (!req.query.memberId) req.query.memberId = idFromPath;
        }
      }
      return callHandler('/verify', req, res);
    }

    if (pathname === '/discord') return callHandler('/discord', req, res);
    if (pathname === '/discord-username-taken') return callHandler('/discord-username-taken', req, res);
    if (pathname === '/contribution-scores') return callHandler('/contribution-scores', req, res);
    if (pathname === '/volunteers') return callHandler('/volunteers', req, res);
    if (pathname === '/repo-tracker') return callHandler('/repo-tracker', req, res);
    if (pathname === '/teams') return callHandler('/teams', req, res);
    if (pathname === '/cron/repo-sync') return callHandler('/cron/repo-sync', req, res);

    sendError(res, 404, 'API endpoint not found');
  } catch (err) {
    console.error('[API][request-error]', { path: req.url, error: err });
    sendError(res, 500, 'Internal server error');
  }
}

export default handleRequest;
