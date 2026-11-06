import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
import { syncMemberRoles, syncSkillRoles, syncTeamRole } from './_lib/discordRoles.js';

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

/**
 * Whether joining the Discord server by itself approves a member. Off by default: approval is an
 * admin decision, and the verified role is granted from that decision (see syncMemberRoles).
 */
const discordAutoApprove = (): boolean => String(process.env.DISCORD_AUTO_APPROVE || '').toLowerCase() === 'true';

/** Supabase reports the provider on the verified user; the portal stores that instead of guessing. */
const authProviderOf = (user: any): 'google' | 'github' | 'traditional' => {
  const provider = String(user?.app_metadata?.provider || '').toLowerCase();
  if (provider === 'github') return 'github';
  if (provider === 'google') return 'google';
  return 'traditional';
};

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
  displayName: row.display_name ?? undefined,
  cocAcceptedAt: row.coc_accepted_at ?? undefined,
  availability: Array.isArray(row.availability) ? row.availability : [],
  hoursPerWeek: row.hours_per_week ?? undefined,
  region: row.region ?? undefined,
  languages: Array.isArray(row.languages) ? row.languages : [],
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
//  Security: rate limiting, CORS allowlist, request size, audit log
// ============================================================================

/** Real client IP on Vercel (x-real-ip / x-vercel-forwarded-for), else the first forwarded hop. */
const clientIpOf = (req: any): string => {
  const h = req.headers || {};
  const raw = String(h['x-real-ip'] || h['x-vercel-forwarded-for'] || String(h['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'unknown');
  return raw.trim().slice(0, 64) || 'unknown';
};

// Portal origins that may call member/admin endpoints from a browser. Public read-only endpoints
// (projects, volunteers, verify, og) stay open to any origin: no cookies are involved.
const ALLOWED_ORIGINS = [
  'https://volunteers.bettergov.ph',
  'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5187',
];
const LOOPBACK_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const isAllowedOrigin = (o: string) =>
  ALLOWED_ORIGINS.includes(o) ||
  /^https:\/\/better-gov-ph-access-card(-[a-z0-9-]+)?\.vercel\.app$/i.test(o) ||
  (process.env.VERCEL_ENV !== 'production' && LOOPBACK_ORIGIN.test(o));
const PUBLIC_READ = new Set(['/projects', '/volunteers', '/verify', '/og', '/contributors']);

const applyCors = (req: any, res: any, pathname: string) => {
  const origin = String(req.headers?.origin || '');
  try {
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
    res.setHeader('Access-Control-Max-Age', '600');
    const publicRead = PUBLIC_READ.has(pathname) || pathname.startsWith('/verify');
    if (origin && isAllowedOrigin(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    else if (publicRead && (req.method === 'GET' || req.method === 'OPTIONS')) res.setHeader('Access-Control-Allow-Origin', '*');
  } catch { /* headers already sent */ }
};

// ----- rate limiting -----
// Two layers: a cheap per-instance burst guard on every request, and shared limits (Postgres,
// atomic, all instances) on writes and on endpoints worth abusing. Limits per user are tighter than
// per IP because schools and mobile networks put many people behind one address (CGNAT).
interface Limit { key: 'ip' | 'user'; name: string; max: number; windowSec: number }
const RATE_RULES: { match: (m: string, p: string, q: any) => boolean; limits: Limit[] }[] = [
  { match: (m, p) => m === 'GET' && p === '/discord-username-taken', limits: [{ key: 'ip', name: 'username-check', max: 30, windowSec: 600 }] },
  { match: (m, p) => m === 'GET' && p.startsWith('/verify'), limits: [{ key: 'ip', name: 'verify', max: 60, windowSec: 600 }] },
  { match: (m, p, q) => m === 'GET' && p === '/repo-tracker' && !!q?.url, limits: [{ key: 'user', name: 'repo-check', max: 30, windowSec: 3600 }] },
  { match: (m, p) => m === 'GET' && p === '/repo-tracker', limits: [{ key: 'ip', name: 'repo-ids', max: 60, windowSec: 600 }] },
  { match: (m, p) => m === 'POST' && p === '/call-interests', limits: [{ key: 'user', name: 'interest', max: 30, windowSec: 3600 }] },
  { match: (m, p) => m === 'POST' && p === '/reports', limits: [{ key: 'user', name: 'report', max: 10, windowSec: 3600 }] },
  { match: (m, p) => m === 'POST' && p === '/submit-project', limits: [{ key: 'user', name: 'submit', max: 10, windowSec: 86400 }] },
  { match: (m, p) => m === 'POST' && p === '/my-project-submissions', limits: [{ key: 'user', name: 'resubmit', max: 20, windowSec: 86400 }] },
  { match: (m, p) => m === 'POST' && p === '/volunteer-calls', limits: [{ key: 'user', name: 'call', max: 20, windowSec: 86400 }] },
  { match: (m, p) => m === 'POST' && p === '/hours', limits: [{ key: 'user', name: 'hours', max: 60, windowSec: 86400 }] },
  { match: (m, p) => m === 'POST' && p === '/project-updates', limits: [{ key: 'user', name: 'update', max: 30, windowSec: 86400 }] },
  { match: (m, p) => m === 'POST' && p === '/teams', limits: [{ key: 'user', name: 'teams', max: 60, windowSec: 3600 }] },
  { match: (m, p, q) => m === 'GET' && p === '/me' && q?.export === '1', limits: [{ key: 'user', name: 'export', max: 10, windowSec: 3600 }] },
  { match: (m, p) => m === 'POST' && p === '/me', limits: [{ key: 'user', name: 'profile', max: 60, windowSec: 3600 }] },
  { match: (m, p) => m === 'POST' && p === '/discord', limits: [{ key: 'user', name: 'discord', max: 20, windowSec: 3600 }] },
];
// Every write also counts toward a general budget.
const WRITE_LIMITS: Limit[] = [
  { key: 'user', name: 'writes', max: 120, windowSec: 600 },
  { key: 'ip', name: 'writes', max: 300, windowSec: 600 },
];

const burst = new Map<string, { n: number; until: number }>();
const BURST_MAX = 120;          // requests per IP per instance…
const BURST_WINDOW_MS = 10_000; // …per 10 seconds
const burstHit = (ip: string) => {
  const now = Date.now();
  const e = burst.get(ip);
  if (!e || e.until <= now) {
    burst.set(ip, { n: 1, until: now + BURST_WINDOW_MS });
    if (burst.size > 5000) for (const [k, v] of burst) if (v.until <= now) burst.delete(k);
    return true;
  }
  e.n += 1;
  return e.n <= BURST_MAX;
};

// Who is calling, for per-user limits. Verified with Supabase (never trust an unverified JWT),
// and cached briefly per instance so writes don't pay for it twice.
const uidCache = new Map<string, { uid: string; until: number }>();
const verifiedUid = async (req: any): Promise<string> => {
  const token = getBearerToken(req.headers?.authorization);
  if (!token) return '';
  const hit = uidCache.get(token);
  if (hit && hit.until > Date.now()) return hit.uid;
  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey) return '';
  try {
    const { data } = await createServiceClient(url, serviceKey).auth.getUser(token);
    const uid = data?.user?.id ? String(data.user.id) : '';
    uidCache.set(token, { uid, until: Date.now() + 60_000 });
    if (uidCache.size > 2000) uidCache.clear();
    return uid;
  } catch { return ''; }
};

const tooMany = (res: any, retryAfterSec: number, limit?: number) => {
  try {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterSec))));
    if (limit) { res.setHeader('RateLimit-Limit', String(limit)); res.setHeader('RateLimit-Remaining', '0'); }
  } catch { /* noop */ }
  const mins = Math.ceil(retryAfterSec / 60);
  sendError(res, 429, retryAfterSec > 90 ? `Too many requests. Try again in about ${mins} minute${mins === 1 ? '' : 's'}.` : 'Too many requests. Wait a moment and try again.');
};

/** Returns false (and has already answered 429) when the request is over a limit. Fails open on infra errors. */
const enforceRateLimits = async (req: any, res: any, pathname: string): Promise<boolean> => {
  const ip = clientIpOf(req);
  if (!burstHit(ip)) { tooMany(res, BURST_WINDOW_MS / 1000, BURST_MAX); return false; }
  const method = String(req.method || 'GET').toUpperCase();
  const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  const rule = RATE_RULES.find((r) => r.match(method, pathname, req.query));
  const limits = [...(rule?.limits ?? []), ...(isWrite ? WRITE_LIMITS : [])];
  if (!limits.length) return true;
  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey) return true;
  const needsUser = limits.some((l) => l.key === 'user');
  const uid = needsUser ? await verifiedUid(req) : '';
  const sb = createServiceClient(url, serviceKey);
  for (const l of limits) {
    // Per-user rules apply to signed-in callers; anonymous callers fall back to their IP.
    const who = l.key === 'user' && uid ? `u:${uid}` : `ip:${ip}`;
    try {
      const { data, error } = await sb.rpc('rate_limit_hit', { p_bucket: `${who}:${l.name}`, p_limit: l.max, p_window_seconds: l.windowSec });
      if (error) continue; // limiter unavailable: don't take the site down with it
      const row = Array.isArray(data) ? data[0] : data;
      if (row && row.ok === false) {
        const retry = (new Date(row.resets).getTime() - Date.now()) / 1000;
        tooMany(res, retry, l.max);
        return false;
      }
    } catch { /* fail open */ }
  }
  // Housekeeping: now and then, clear windows that ended over a day ago.
  if (Math.random() < 0.01) {
    try { await sb.from('rate_limits').delete().lt('window_ends', new Date(Date.now() - 86_400_000).toISOString()); } catch { /* noop */ }
  }
  return true;
};

// ----- admin audit log -----
const audit = async (supabase: any, req: any, actorId: string, action: string, target?: { type?: string; id?: string }, details: Record<string, unknown> = {}) => {
  try {
    await supabase.from('admin_audit_log').insert({
      actor_id: actorId, action, target_type: target?.type ?? null, target_id: target?.id ? String(target.id) : null,
      details, ip: clientIpOf(req),
    });
  } catch { /* table missing before the migration */ }
};

// ----- input hygiene -----
const SKILL_LEVELS = ['Learner', 'Practitioner', 'Expert'];
const sanitizeSkills = (raw: unknown) => {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: { name: string; level: string; featured?: boolean }[] = [];
  for (const s of raw.slice(0, 60)) {
    if (!s || typeof s !== 'object') continue;
    const name = typeof (s as any).name === 'string' ? (s as any).name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60) : '';
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const level = SKILL_LEVELS.includes((s as any).level) ? (s as any).level : 'Learner';
    out.push({ name, level, ...((s as any).featured === true ? { featured: true } : {}) });
  }
  return out;
};
const MAX_BODY_BYTES = 64 * 1024;


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
/** Usernames and pseudonyms: printable, short, no markup. */
const cleanDisplayName = (v: unknown) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
/** Public pages: the member's chosen display name, else their redacted (or opted-in full) legal name. */
const publicNameOf = (row: any) =>
  cleanDisplayName(row?.display_name) ||
  (row?.show_full_name === true ? String(row?.full_name || '').trim() || 'Member' : redactName(row?.full_name || ''));
/** Signed-in members: the display name if set, else the real name. Only admins always see the legal name. */
const memberNameOf = (row: any) => cleanDisplayName(row?.display_name) || String(row?.full_name || '').trim() || 'Member';

// Group chats are where many non-tech volunteers already are (meeting 2026-11-04): Messenger, WhatsApp, Viber…
const CHAT_HOSTS = ['m.me', 'messenger.com', 'facebook.com', 'chat.whatsapp.com', 'wa.me', 'whatsapp.com', 'invite.viber.com', 'viber.com',
  'vb.me', 't.me', 'telegram.me', 'discord.gg', 'discord.com', 'signal.group', 'chat.google.com', 'join.slack.com', 'slack.com'];
const sanitizeChatUrl = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim().startsWith('http') ? raw.trim() : `https://${raw.trim()}`);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (u.protocol !== 'https:' || !CHAT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
    return u.toString().slice(0, 300);
  } catch { return null; }
};

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

// ----- Notifications ---------------------------------------------------------
/** Best effort: a missing table (before the migration) or a failed insert never breaks the action itself. */
const notify = async (supabase: any, userId: string | null | undefined, n: { kind: string; title: string; body?: string; link?: string }) => {
  if (!userId) return;
  try {
    await supabase.from('notifications').insert({
      user_id: userId, kind: n.kind, title: n.title.slice(0, 200), body: n.body ? n.body.slice(0, 400) : null, link: n.link ?? null,
    });
  } catch { /* noop */ }
};
const notifyAdmins = async (supabase: any, n: { kind: string; title: string; body?: string; link?: string }) => {
  try {
    const { data } = await supabase.from('users').select('uid').eq('is_admin', true).limit(50);
    await Promise.all((data ?? []).map((a: any) => notify(supabase, a.uid, n)));
  } catch { /* noop */ }
};
const quote = (t: unknown, max = 60) => {
  const v = String(t || '').trim();
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
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
    const repo = await fetchRepoStats(url);
    sendJson(res, 200, { repo: repo.ok && repo.isPrivate ? { slug: repo.slug, url: repo.url, ok: false, error: 'That repository is private. Make it public to track it here.', checkedAt: repo.checkedAt } : repo });
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
  try { await supabase.from('rate_limits').delete().lt('window_ends', new Date(Date.now() - 86_400_000).toISOString()); } catch { /* noop */ }
  // Refresh the contributors list daily, so it never waits on the first visitor.
  try { await setCache(CONTRIBUTORS_CACHE, await buildContributors(), 3600); } catch { /* the next visitor rebuilds it */ }
  sendJson(res, 200, { refreshed });
};

// ---------- /call-interests ---------------------------------------------------
// POST { callId, message?, contact? }          raise a hand (signed-in members)
// POST { action: 'withdraw', callId }           take it back
// POST { action: 'mark', interestId, status }   poster/admin: new | contacted
// GET  ?call=ID                                  poster/admin: who is interested
const handler_call_interests: H = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') { sendError(res, 405, 'Method not allowed'); return; }
  const caller = await authCaller(req);
  if ('error' in caller) { sendError(res, 500, caller.error); return; }
  const { supabase, uid } = caller;
  if (!uid) { sendError(res, 401, 'Sign in to continue'); return; }
  const { data: me } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
  const isAdmin = !!me?.is_admin;

  const loadCall = async (id: string) => {
    if (!isUuid(id)) return null;
    const { data } = await supabase.from('volunteer_calls').select('id, user_id, status, title').eq('id', id).maybeSingle();
    return data ?? null;
  };

  if (req.method === 'GET') {
    const callId = getStringParam(req.query?.call) || '';
    const call = await loadCall(callId);
    if (!call) { sendError(res, 404, 'Call not found'); return; }
    if (call.user_id !== uid && !isAdmin) { sendError(res, 403, 'Only the person who posted this can see who’s interested.'); return; }
    if (!isAdmin && String(me?.status || '').toLowerCase() !== 'approved') { sendError(res, 403, 'Your membership needs to be approved first.'); return; }
    const { data: ints, error } = await supabase.from('call_interests').select('*').eq('call_id', callId).neq('status', 'withdrawn').order('created_at', { ascending: true });
    if (error) { sendError(res, 500, 'Failed to load'); return; }
    const ids = (ints ?? []).map((i: any) => i.user_id);
    const { data: users } = ids.length ? await supabase.from('users').select('*').in('uid', ids) : { data: [] as any[] };
    const byId = new Map((users ?? []).map((u: any) => [String(u.uid), u]));
    sendJson(res, 200, {
      interests: (ints ?? []).map((i: any) => {
        const u: any = byId.get(String(i.user_id));
        return {
          id: i.id, status: i.status, message: i.message ?? '', contact: i.contact ?? '', createdAt: i.created_at,
          person: {
            name: u ? (isAdmin ? u.full_name : memberNameOf(u)) : 'Member',
            role: u?.specialization ?? null, secondaryRole: u?.secondary_specialization ?? null,
            memberId: u?.member_id ?? null, approved: String(u?.status || '').toLowerCase() === 'approved',
            avatarUrl: discordAvatarOf(u), discordUsername: u?.discord_username || null, ...availabilityOf(u),
            skills: Array.isArray(u?.skills) ? u.skills.slice(0, 6).map((s: any) => s?.name).filter(Boolean) : [],
          },
        };
      }),
    });
    return;
  }

  const body = getBody(req);
  const action = typeof body.action === 'string' ? body.action : 'interest';
  const now = new Date().toISOString();

  if (action === 'mark') {
    const interestId = typeof body.interestId === 'string' && isUuid(body.interestId) ? body.interestId : '';
    const status = body.status === 'contacted' ? 'contacted' : body.status === 'new' ? 'new' : '';
    if (!interestId || !status) { sendError(res, 400, 'interestId and status (new|contacted) are required'); return; }
    const { data: row } = await supabase.from('call_interests').select('id, call_id').eq('id', interestId).maybeSingle();
    const call = row ? await loadCall(row.call_id) : null;
    if (!call) { sendError(res, 404, 'Not found'); return; }
    if (call.user_id !== uid && !isAdmin) { sendError(res, 403, 'Only the poster can do that.'); return; }
    const { data: before } = await supabase.from('call_interests').select('user_id, status').eq('id', interestId).maybeSingle();
    const { error } = await supabase.from('call_interests').update({ status, updated_at: now }).eq('id', interestId);
    if (error) { sendError(res, 500, 'Couldn’t update'); return; }
    if (status === 'contacted' && before?.status !== 'contacted') {
      await notify(supabase, before?.user_id, {
        kind: 'interest_contacted', title: `The team behind “${quote(call.title)}” has seen your interest`,
        body: 'They’ll reach you through the contact you left, or the group chat.', link: `/opportunities?call=${call.id}`,
      });
    }
    sendJson(res, 200, { status });
    return;
  }

  const callId = typeof body.callId === 'string' ? body.callId : '';
  const call = await loadCall(callId);
  if (!call) { sendError(res, 404, 'Call not found'); return; }

  if (action === 'withdraw') {
    const { error } = await supabase.from('call_interests').update({ status: 'withdrawn', updated_at: now }).eq('call_id', callId).eq('user_id', uid);
    if (error) { sendError(res, 500, 'Couldn’t update'); return; }
    sendJson(res, 200, { status: 'withdrawn' });
    return;
  }

  // Raise a hand. A finished profile is enough; membership approval isn't required to say "I'm interested".
  if (!me || !String(me.full_name || '').trim() || !String(me.specialization || '').trim()) {
    sendError(res, 409, 'Finish your profile first, then come back to this call.'); return;
  }
  if (call.status !== 'open') { sendError(res, 400, 'This call is closed.'); return; }
  if (call.user_id === uid) { sendError(res, 400, 'This is your own call.'); return; }
  // Raising a hand again keeps the earlier note and contact unless new ones are given.
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, 200) : '';
  const payload: Record<string, any> = {
    call_id: callId, user_id: uid, status: 'new', updated_at: now,
    ...(message ? { message } : {}), ...(contact ? { contact } : {}),
  };
  const { data: prior } = await supabase.from('call_interests').select('status').eq('call_id', callId).eq('user_id', uid).maybeSingle();
  const { error } = await supabase.from('call_interests').upsert(payload, { onConflict: 'call_id,user_id' });
  if (error) { sendError(res, isMissingTableError(error) ? 503 : 500, 'Couldn’t save your interest. Try again.'); return; }
  if (!prior) {
    await notify(supabase, call.user_id, {
      kind: 'interest_new', title: `${memberNameOf(me)} is interested in “${quote(call.title)}”`,
      body: message || 'Open the call to see how to reach them.', link: '/dashboard/calls',
    });
  }
  sendJson(res, 200, { status: 'new' });
};

// ---------- /notifications ----------------------------------------------------
const handler_notifications: H = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') { sendError(res, 405, 'Method not allowed'); return; }
  const caller = await authCaller(req);
  if ('error' in caller) { sendError(res, 500, caller.error); return; }
  const { supabase, uid } = caller;
  if (!uid) { sendError(res, 401, 'Sign in first'); return; }
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('notifications').select('id, kind, title, body, link, read_at, created_at')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(30);
    if (error) { sendJson(res, 200, { items: [], unread: 0, available: !isMissingTableError(error) }); return; }
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', uid).is('read_at', null);
    sendJson(res, 200, {
      available: true, unread: count ?? 0,
      items: (data ?? []).map((n: any) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: !!n.read_at, createdAt: n.created_at })),
    });
    return;
  }
  const body = getBody(req);
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string' && isUuid(x)).slice(0, 100) : [];
  let q: any = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', uid).is('read_at', null);
  if (ids.length) q = q.in('id', ids);
  const { error } = await q;
  if (error) { sendError(res, isMissingTableError(error) ? 503 : 500, 'Couldn’t update'); return; }
  sendJson(res, 200, { ok: true });
};

// ---------- /reports ---------------------------------------------------------
// POST { targetType, targetId, reason, details? }   any signed-in member
// GET  ?status=open                                  admins: the queue
// POST { action: 'resolve', id, status, resolution?, hide? }   admins
const REPORT_REASONS = ['spam', 'harassment', 'misleading', 'privacy', 'other'];
const handler_reports: H = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') { sendError(res, 405, 'Method not allowed'); return; }
  const caller = await authCaller(req);
  if ('error' in caller) { sendError(res, 500, caller.error); return; }
  const { supabase, uid } = caller;
  if (!uid) { sendError(res, 401, 'Sign in to report'); return; }
  const { data: me } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
  const isAdmin = !!me?.is_admin;

  const titleOf = async (type: string, id: string) => {
    if (type === 'call') {
      const { data } = await supabase.from('volunteer_calls').select('id, title, user_id, status').eq('id', id).maybeSingle();
      return data ? { title: data.title as string, owner: data.user_id as string, status: data.status as string } : null;
    }
    const { data } = await supabase.from('project_submissions').select('id, project_name, user_id, status').eq('id', id).maybeSingle();
    return data ? { title: data.project_name as string, owner: data.user_id as string, status: data.status as string } : null;
  };

  if (req.method === 'GET') {
    if (!isAdmin) { sendError(res, 403, 'Admin only'); return; }
    const status = getStringParam(req.query?.status) || 'open';
    let q: any = supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(100);
    if (status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) { sendJson(res, 200, { reports: [], available: !isMissingTableError(error) }); return; }
    const reporterIds = Array.from(new Set((data ?? []).map((r: any) => r.reporter_id)));
    const { data: reporters } = reporterIds.length ? await supabase.from('users').select('*').in('uid', reporterIds) : { data: [] as any[] };
    const nameById = new Map((reporters ?? []).map((u: any) => [String(u.uid), String(u.full_name || 'Member')]));
    const reports = await Promise.all((data ?? []).map(async (r: any) => {
      const t = isUuid(String(r.target_id)) ? await titleOf(r.target_type, r.target_id) : null;
      return {
        id: r.id, targetType: r.target_type, targetId: r.target_id, targetTitle: t?.title ?? '(removed)', targetStatus: t?.status ?? null,
        reason: r.reason, details: r.details ?? '', status: r.status, resolution: r.resolution ?? '', createdAt: r.created_at,
        reporter: nameById.get(String(r.reporter_id)) ?? 'Member',
      };
    }));
    sendJson(res, 200, { available: true, reports });
    return;
  }

  const body = getBody(req);
  if (body.action === 'resolve') {
    if (!isAdmin) { sendError(res, 403, 'Admin only'); return; }
    const id = typeof body.id === 'string' && isUuid(body.id) ? body.id : '';
    const status = body.status === 'dismissed' ? 'dismissed' : body.status === 'actioned' ? 'actioned' : '';
    if (!id || !status) { sendError(res, 400, 'id and status (dismissed|actioned) are required'); return; }
    const { data: rep } = await supabase.from('reports').select('*').eq('id', id).maybeSingle();
    if (!rep) { sendError(res, 404, 'Report not found'); return; }
    const resolution = typeof body.resolution === 'string' ? body.resolution.trim().slice(0, 500) : '';
    // "Hide" takes the item off public pages: closes a call, or sends a project back to review.
    if (status === 'actioned' && body.hide === true && isUuid(String(rep.target_id))) {
      if (rep.target_type === 'call') {
        let r = await supabase.from('volunteer_calls').update({ status: 'closed', admin_hidden: true }).eq('id', rep.target_id);
        if (r.error) r = await supabase.from('volunteer_calls').update({ status: 'closed' }).eq('id', rep.target_id);
      }
      else {
        await supabase.from('project_submissions').update({ status: 'pending', admin_note: resolution || 'Hidden after a report while an admin reviews it.' }).eq('id', rep.target_id);
        try { await invalidateCache('cache:projects:approved'); await invalidateCache('cache:projects:approved:merged'); } catch { /* noop */ }
      }
    }
    const { error } = await supabase.from('reports')
      .update({ status, resolution: resolution || null, resolved_at: new Date().toISOString(), resolved_by: uid })
      // Close every open report on the same item at once.
      .eq('target_type', rep.target_type).eq('target_id', rep.target_id).eq('status', 'open');
    if (error) { sendError(res, 500, 'Couldn’t update'); return; }
    await audit(supabase, req, uid, 'report.resolve', { type: rep.target_type, id: rep.target_id }, { status, hide: body.hide === true });
    sendJson(res, 200, { status });
    return;
  }

  const targetType = body.targetType === 'call' || body.targetType === 'project' ? body.targetType : '';
  const targetId = typeof body.targetId === 'string' && isUuid(body.targetId) ? body.targetId : '';
  const reason = typeof body.reason === 'string' && REPORT_REASONS.includes(body.reason) ? body.reason : '';
  if (!targetType || !targetId || !reason) { sendError(res, 400, 'targetType, targetId and reason are required'); return; }
  const target = await titleOf(targetType, targetId);
  if (!target) { sendError(res, 404, 'Not found'); return; }
  if (target.owner === uid) { sendError(res, 400, 'You can’t report your own post. Edit or close it instead.'); return; }
  const { error } = await supabase.from('reports').insert({
    reporter_id: uid, target_type: targetType, target_id: targetId, reason,
    details: typeof body.details === 'string' ? body.details.trim().slice(0, 1000) || null : null,
  });
  if (error) {
    if (String((error as any).code) === '23505') { sendJson(res, 200, { status: 'already_reported' }); return; }
    sendError(res, isMissingTableError(error) ? 503 : 500, isMissingTableError(error) ? 'Reporting opens soon.' : 'Couldn’t send the report');
    return;
  }
  await notifyAdmins(supabase, {
    kind: 'report_new', title: `New report: ${quote(target.title)}`, body: `Reason: ${reason}`, link: '/admin?reports=1',
  });
  sendJson(res, 200, { status: 'received' });
};

// ============================================================================
//  Hours, certificates, project updates, share previews (migration 20261105000500)
// ============================================================================
const PH_REGIONS = ['NCR', 'CAR', 'Ilocos Region', 'Cagayan Valley', 'Central Luzon', 'CALABARZON', 'MIMAROPA', 'Bicol Region',
  'Western Visayas', 'Central Visayas', 'Eastern Visayas', 'Zamboanga Peninsula', 'Northern Mindanao', 'Davao Region',
  'SOCCSKSARGEN', 'Caraga', 'BARMM', 'Abroad'];
const LANGS = ['Filipino', 'English', 'Cebuano', 'Ilocano', 'Hiligaynon', 'Bikol', 'Waray', 'Kapampangan', 'Pangasinan',
  'Maranao', 'Maguindanaon', 'Tausug', 'Chavacano', 'Kinaray-a', 'Surigaonon', 'Other'];
const AVAIL = ['weekdays', 'weeknights', 'weekends'];
const HOURS_PW = ['1-2', '3-5', '6-10', '10+'];
const PROJECT_STAGES = ['idea', 'building', 'beta', 'live', 'completed', 'needs-lead'];

/** When and where someone can help, for posters and team heads (not public). */
const availabilityOf = (u: any) => ({
  availability: Array.isArray(u?.availability) ? u.availability : [],
  hoursPerWeek: u?.hours_per_week ?? null,
  region: u?.region ?? null,
  languages: Array.isArray(u?.languages) ? u.languages : [],
});

const isTeamMember = async (supabase: any, projectId: string, uid: string) => {
  const { data: project } = await supabase.from('project_submissions').select('id, user_id, team_head_id, status, project_name').eq('id', projectId).maybeSingle();
  if (!project) return { project: null, member: false, head: false };
  const { data: row } = await supabase.from('team_members').select('role, status').eq('project_id', String(projectId)).eq('user_id', uid).maybeSingle();
  const head = project.team_head_id === uid || (row?.role === 'head' && row?.status === 'approved') || (!project.team_head_id && project.user_id === uid);
  return { project, member: head || row?.status === 'approved', head };
};

// ---------- /hours -------------------------------------------------------------
// GET  ?mine=1        my entries and totals
// GET  ?toConfirm=1   entries I can confirm (teams I lead, calls I posted; everything for admins)
// POST { projectId | callId, hours, activity, workedOn }     log hours
// POST { action: 'decide', id, decision: 'confirm' | 'decline' }
// POST { action: 'delete', id }                               remove my own pending entry
const handler_hours: H = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') { sendError(res, 405, 'Method not allowed'); return; }
  const caller = await authCaller(req);
  if ('error' in caller) { sendError(res, 500, caller.error); return; }
  const { supabase, uid } = caller;
  if (!uid) { sendError(res, 401, 'Sign in first'); return; }
  const { data: me } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
  const isAdmin = !!me?.is_admin;

  const label = async (rows: any[]) => {
    const pids = Array.from(new Set(rows.map((r) => r.project_id).filter(Boolean)));
    const cids = Array.from(new Set(rows.map((r) => r.call_id).filter(Boolean)));
    const uids = Array.from(new Set(rows.map((r) => r.user_id)));
    const [{ data: ps }, { data: cs }, { data: us }] = await Promise.all([
      pids.length ? supabase.from('project_submissions').select('id, project_name').in('id', pids) : Promise.resolve({ data: [] as any[] }),
      cids.length ? supabase.from('volunteer_calls').select('id, title').in('id', cids) : Promise.resolve({ data: [] as any[] }),
      uids.length ? supabase.from('users').select('*').in('uid', uids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const pn = new Map((ps ?? []).map((p: any) => [String(p.id), p.project_name]));
    const cn = new Map((cs ?? []).map((c: any) => [String(c.id), c.title]));
    const un = new Map((us ?? []).map((u: any) => [String(u.uid), u]));
    return rows.map((r) => ({
      id: r.id, hours: Number(r.hours), activity: r.activity, workedOn: r.worked_on, status: r.status, createdAt: r.created_at,
      projectId: r.project_id, callId: r.call_id,
      where: (r.project_id ? pn.get(String(r.project_id)) : cn.get(String(r.call_id))) ?? r.context_label ?? 'Volunteering',
      person: { name: isAdmin ? un.get(String(r.user_id))?.full_name : memberNameOf(un.get(String(r.user_id))), memberId: un.get(String(r.user_id))?.member_id ?? null },
    }));
  };

  if (req.method === 'GET') {
    if (getStringParam(req.query?.mine)) {
      const { data, error } = await supabase.from('volunteer_hours').select('*').eq('user_id', uid).order('worked_on', { ascending: false }).limit(200);
      if (error) { sendJson(res, 200, { entries: [], totals: { confirmed: 0, pending: 0 }, available: !isMissingTableError(error) }); return; }
      const sum = (st: string) => (data ?? []).filter((r: any) => r.status === st).reduce((a: number, r: any) => a + Number(r.hours), 0);
      sendJson(res, 200, { available: true, entries: await label(data ?? []), totals: { confirmed: sum('confirmed'), pending: sum('pending') } });
      return;
    }
    if (getStringParam(req.query?.toConfirm)) {
      let q: any = supabase.from('volunteer_hours').select('*').eq('status', 'pending').neq('user_id', uid).order('created_at', { ascending: true }).limit(100);
      if (!isAdmin) {
        const [{ data: led }, { data: heads }, { data: mine }] = await Promise.all([
          supabase.from('project_submissions').select('id').eq('team_head_id', uid),
          supabase.from('team_members').select('project_id').eq('user_id', uid).eq('role', 'head').eq('status', 'approved'),
          supabase.from('volunteer_calls').select('id').eq('user_id', uid),
        ]);
        const pids = Array.from(new Set([...(led ?? []).map((p: any) => String(p.id)), ...(heads ?? []).map((h: any) => String(h.project_id))]));
        const cids = (mine ?? []).map((c: any) => c.id);
        if (!pids.length && !cids.length) { sendJson(res, 200, { entries: [] }); return; }
        const ors = [pids.length ? `project_id.in.(${pids.join(',')})` : '', cids.length ? `call_id.in.(${cids.join(',')})` : ''].filter(Boolean).join(',');
        q = q.or(ors);
      }
      const { data, error } = await q;
      if (error) { sendJson(res, 200, { entries: [] }); return; }
      sendJson(res, 200, { entries: await label(data ?? []) });
      return;
    }
    sendError(res, 400, 'Use ?mine=1 or ?toConfirm=1');
    return;
  }

  const body = getBody(req);
  const action = typeof body.action === 'string' ? body.action : 'log';
  const now = new Date().toISOString();

  if (action === 'decide' || action === 'delete') {
    const id = typeof body.id === 'string' && isUuid(body.id) ? body.id : '';
    const { data: entry } = id ? await supabase.from('volunteer_hours').select('*').eq('id', id).maybeSingle() : { data: null };
    if (!entry) { sendError(res, 404, 'Entry not found'); return; }
    if (action === 'delete') {
      if (entry.user_id !== uid || entry.status !== 'pending') { sendError(res, 403, 'You can only remove your own unconfirmed hours.'); return; }
      await supabase.from('volunteer_hours').delete().eq('id', id);
      sendJson(res, 200, { deleted: true });
      return;
    }
    if (entry.user_id === uid) { sendError(res, 403, 'Someone else has to confirm your hours.'); return; }
    if (entry.status !== 'pending') { sendError(res, 400, 'This entry was already decided.'); return; }
    if (!isAdmin && String(me?.status || '').toLowerCase() !== 'approved') { sendError(res, 403, 'Only approved members can confirm hours.'); return; }
    let allowed = isAdmin;
    let where = 'your volunteering';
    if (!allowed && entry.project_id) { const t = await isTeamMember(supabase, entry.project_id, uid); allowed = t.head; where = t.project?.project_name ?? where; }
    if (!allowed && entry.call_id) {
      const { data: call } = await supabase.from('volunteer_calls').select('user_id, title').eq('id', entry.call_id).maybeSingle();
      allowed = call?.user_id === uid; where = call?.title ?? where;
    }
    if (!allowed) { sendError(res, 403, 'Only the team head, the call poster or an admin can confirm hours.'); return; }
    const status = body.decision === 'confirm' ? 'confirmed' : body.decision === 'decline' ? 'declined' : '';
    if (!status) { sendError(res, 400, 'decision must be confirm or decline'); return; }
    const { error } = await supabase.from('volunteer_hours').update({ status, confirmed_by: uid, decided_at: now }).eq('id', id);
    if (error) { sendError(res, 500, 'Couldn’t save'); return; }
    await notify(supabase, entry.user_id, status === 'confirmed'
      ? { kind: 'hours_confirmed', title: `${Number(entry.hours)} h confirmed for ${quote(where)}`, body: 'They count toward your certificate of volunteer service.', link: '/certificate' }
      : { kind: 'hours_declined', title: `Hours for ${quote(where)} weren’t confirmed`, body: 'Talk to the team head if this looks wrong.', link: '/dashboard' });
    sendJson(res, 200, { status });
    return;
  }

  // Log hours
  const hours = Math.round(Number(body.hours) * 2) / 2;
  if (!Number.isFinite(hours) || hours < 0.5 || hours > 24) { sendError(res, 400, 'Log between 0.5 and 24 hours per entry.'); return; }
  const activity = typeof body.activity === 'string' ? body.activity.trim().slice(0, 200) : '';
  if (activity.length < 3) { sendError(res, 400, 'Say briefly what you did.'); return; }
  const workedOn = typeof body.workedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.workedOn) ? body.workedOn : '';
  const day = workedOn ? new Date(`${workedOn}T00:00:00Z`).getTime() : NaN;
  if (!workedOn || Number.isNaN(day) || day > Date.now() + 86_400_000 || day < Date.now() - 366 * 86_400_000) {
    sendError(res, 400, 'Pick the day you did it (within the last year).'); return;
  }
  // No more than 24 h logged for any one day, across all entries.
  const { data: sameDay } = await supabase.from('volunteer_hours').select('hours, status').eq('user_id', uid).eq('worked_on', workedOn).neq('status', 'declined');
  const dayTotal = (sameDay ?? []).reduce((a: number, r: any) => a + Number(r.hours), 0);
  if (dayTotal + hours > 24) { sendError(res, 400, `That day already has ${dayTotal} h logged; a day has 24.`); return; }
  const projectId = typeof body.projectId === 'string' || typeof body.projectId === 'number' ? String(body.projectId) : '';
  const callId = typeof body.callId === 'string' && isUuid(body.callId) ? body.callId : '';
  let notifyId: string | null = null;
  let where = '';
  if (projectId) {
    const t = await isTeamMember(supabase, projectId, uid);
    if (!t.project) { sendError(res, 404, 'Project not found'); return; }
    if (!t.member) { sendError(res, 403, 'Join the team first, then log your hours.'); return; }
    notifyId = t.head ? null : t.project.team_head_id || t.project.user_id;
    where = t.project.project_name;
  } else if (callId) {
    const { data: call } = await supabase.from('volunteer_calls').select('id, user_id, title').eq('id', callId).maybeSingle();
    if (!call) { sendError(res, 404, 'Call not found'); return; }
    const { data: hand } = await supabase.from('call_interests').select('status').eq('call_id', callId).eq('user_id', uid).maybeSingle();
    if (!hand || hand.status === 'withdrawn') { sendError(res, 403, 'Say you’re interested in the call first.'); return; }
    notifyId = call.user_id; where = call.title;
  } else { sendError(res, 400, 'projectId or callId is required'); return; }
  const { data: row, error } = await supabase.from('volunteer_hours').insert({
    user_id: uid, project_id: projectId || null, call_id: callId || null, hours, activity, worked_on: workedOn,
    context_label: String(where || '').slice(0, 160) || null,
  }).select('id').maybeSingle();
  if (error) { sendError(res, isMissingTableError(error) ? 503 : 500, 'Couldn’t log your hours'); return; }
  if (notifyId) {
    await notify(supabase, notifyId, {
      kind: 'hours_to_confirm', title: `${memberNameOf(me)} logged ${hours} h on ${quote(where)}`, body: activity, link: '/dashboard',
    });
  }
  sendJson(res, 200, { id: row?.id, status: 'pending' });
};

// ---------- /certificate -------------------------------------------------------
// Data for the printable certificate of volunteer service. Approved members only; uses the legal
// name (schools and NSTP offices need it) and only confirmed hours.
const handler_certificate: H = async (req, res) => {
  if (req.method !== 'GET') { sendError(res, 405, 'Method not allowed'); return; }
  const caller = await authCaller(req);
  if ('error' in caller) { sendError(res, 500, caller.error); return; }
  const { supabase, uid } = caller;
  if (!uid) { sendError(res, 401, 'Sign in first'); return; }
  const { data: me } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
  if (!me) { sendError(res, 404, 'Profile not found'); return; }
  if (String(me.status || '').toLowerCase() !== 'approved' && !me.is_admin) { sendError(res, 403, 'Certificates are for approved members.'); return; }
  const { data: rows } = await supabase.from('volunteer_hours').select('*').eq('user_id', uid).eq('status', 'confirmed');
  const pids = Array.from(new Set((rows ?? []).map((r: any) => r.project_id).filter(Boolean)));
  const cids = Array.from(new Set((rows ?? []).map((r: any) => r.call_id).filter(Boolean)));
  const [{ data: ps }, { data: cs }, { data: teams }] = await Promise.all([
    pids.length ? supabase.from('project_submissions').select('id, project_name').in('id', pids) : Promise.resolve({ data: [] as any[] }),
    cids.length ? supabase.from('volunteer_calls').select('id, title').in('id', cids) : Promise.resolve({ data: [] as any[] }),
    supabase.from('team_members').select('project_id, role, team_role').eq('user_id', uid).eq('status', 'approved'),
  ]);
  const pn = new Map((ps ?? []).map((p: any) => [String(p.id), p.project_name]));
  const cn = new Map((cs ?? []).map((c: any) => [String(c.id), c.title]));
  const byWhere = new Map<string, { name: string; hours: number; from: string; to: string }>();
  for (const r of rows ?? []) {
    const key = r.project_id ? `p:${r.project_id}` : r.call_id ? `c:${r.call_id}` : `l:${r.context_label ?? ''}`;
    const name = (r.project_id ? pn.get(String(r.project_id)) : r.call_id ? cn.get(String(r.call_id)) : null) ?? r.context_label ?? 'Volunteering';
    const cur = byWhere.get(key) ?? { name, hours: 0, from: r.worked_on, to: r.worked_on };
    cur.hours += Number(r.hours);
    if (r.worked_on < cur.from) cur.from = r.worked_on;
    if (r.worked_on > cur.to) cur.to = r.worked_on;
    byWhere.set(key, cur);
  }
  const total = Array.from(byWhere.values()).reduce((a, b) => a + b.hours, 0);
  sendJson(res, 200, {
    name: me.full_name, memberId: me.member_id ?? null, role: me.specialization ?? null, secondaryRole: me.secondary_specialization ?? null,
    communityRole: me.role ?? 'Member', yearJoined: me.year_joined ?? null, totalHours: total,
    items: Array.from(byWhere.values()).sort((a, b) => b.hours - a.hours),
    teams: (teams ?? []).length, issuedAt: new Date().toISOString(),
  });
};

// ---------- /project-updates ----------------------------------------------------
const handler_project_updates: H = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') { sendError(res, 405, 'Method not allowed'); return; }
  const caller = await authCaller(req);
  if ('error' in caller) { sendError(res, 500, caller.error); return; }
  const { supabase, uid } = caller;
  if (req.method === 'GET') {
    const projectId = getStringParam(req.query?.project) || '';
    const { data: project } = projectId ? await supabase.from('project_submissions').select('id, status, user_id, team_head_id').eq('id', projectId).maybeSingle() : { data: null };
    if (!project) { sendError(res, 404, 'Project not found'); return; }
    if (String(project.status || '').toLowerCase() !== 'approved' && project.user_id !== uid && project.team_head_id !== uid) { sendError(res, 404, 'Project not found'); return; }
    const { data, error } = await supabase.from('project_updates').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50);
    if (error) { sendJson(res, 200, { updates: [], available: !isMissingTableError(error) }); return; }
    const ids = Array.from(new Set((data ?? []).map((u: any) => u.author_id)));
    const { data: us } = ids.length ? await supabase.from('users').select('*').in('uid', ids) : { data: [] as any[] };
    const by = new Map((us ?? []).map((u: any) => [String(u.uid), u]));
    sendJson(res, 200, {
      available: true,
      updates: (data ?? []).map((u: any) => ({
        id: u.id, body: u.body, createdAt: u.created_at, mine: !!uid && u.author_id === uid,
        author: publicNameOf(by.get(String(u.author_id))), avatarUrl: discordAvatarOf(by.get(String(u.author_id))),
      })),
    });
    return;
  }
  if (!uid) { sendError(res, 401, 'Sign in first'); return; }
  const body = getBody(req);
  const { data: me } = await supabase.from('users').select('is_admin').eq('uid', uid).maybeSingle();
  if (body.action === 'delete') {
    const id = typeof body.id === 'string' && isUuid(body.id) ? body.id : '';
    const { data: u } = id ? await supabase.from('project_updates').select('*').eq('id', id).maybeSingle() : { data: null };
    if (!u) { sendError(res, 404, 'Not found'); return; }
    const t = await isTeamMember(supabase, u.project_id, uid);
    if (u.author_id !== uid && !t.head && !me?.is_admin) { sendError(res, 403, 'Only the author or the team head can delete this.'); return; }
    await supabase.from('project_updates').delete().eq('id', id);
    sendJson(res, 200, { deleted: true });
    return;
  }
  const projectId = typeof body.projectId === 'string' || typeof body.projectId === 'number' ? String(body.projectId) : '';
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : '';
  if (!projectId || text.length < 2) { sendError(res, 400, 'Write an update first.'); return; }
  const t = await isTeamMember(supabase, projectId, uid);
  if (!t.project) { sendError(res, 404, 'Project not found'); return; }
  if (!t.member && !me?.is_admin) { sendError(res, 403, 'Only team members can post updates.'); return; }
  const { data: row, error } = await supabase.from('project_updates').insert({ project_id: projectId, author_id: uid, body: text }).select('id').maybeSingle();
  if (error) { sendError(res, isMissingTableError(error) ? 503 : 500, 'Couldn’t post the update'); return; }
  sendJson(res, 200, { id: row?.id });
};

// ---------- /og: link previews for Messenger, Facebook, WhatsApp, Viber ----------
// vercel.json routes /projects/:id and /opportunities here; we return the normal app page with
// that project's or call's title and description in the <head>, so a shared link shows them.
const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const handler_og: H = async (req, res) => {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || 'volunteers.bettergov.ph');
  const origin = `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`;
  const kind = getStringParam(req.query?.kind);
  let title = 'BetterGovPH Volunteers';
  let description = 'Find something to help with: civic tech projects and calls for volunteers in the Philippines.';
  let path = '/';
  try {
    const { url, serviceKey } = getSupabaseConfig();
    const sb = url && serviceKey ? createServiceClient(url, serviceKey) : null;
    if (sb && kind === 'project') {
      const id = getStringParam(req.query?.id) || '';
      path = `/projects/${encodeURIComponent(id)}`;
      const { data: p } = isUuid(id) ? await sb.from('project_submissions').select('project_name, description, status').eq('id', id).maybeSingle() : { data: null };
      if (p && String(p.status || '').toLowerCase() === 'approved') {
        title = `${p.project_name} · BetterGovPH Volunteers`;
        description = String(p.description || '').slice(0, 200) || 'A BetterGovPH community project. See the team and how to help.';
      }
    } else if (sb && kind === 'opportunities') {
      const callId = getStringParam(req.query?.call) || '';
      path = callId ? `/opportunities?call=${encodeURIComponent(callId)}` : '/opportunities';
      title = 'Find something to help with · BetterGovPH Volunteers';
      if (isUuid(callId)) {
        const { data: c } = await sb.from('volunteer_calls').select('title, description, status, call_type').eq('id', callId).maybeSingle();
        if (c && c.status === 'open') {
          title = `${c.call_type && c.call_type !== 'people' ? 'Request' : 'Volunteers needed'}: ${c.title}`;
          description = String(c.description || '').slice(0, 200);
        }
      }
    }
  } catch { /* fall back to the defaults */ }
  const meta = [
    `<title>${escHtml(title)}</title>`,
    `<meta name="description" content="${escHtml(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="BetterGovPH Volunteers">`,
    `<meta property="og:title" content="${escHtml(title)}">`,
    `<meta property="og:description" content="${escHtml(description)}">`,
    `<meta property="og:url" content="${escHtml(origin + path)}">`,
    `<meta property="og:image" content="${escHtml(origin)}/og-default.png">`,
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('');
  let html = '';
  try {
    const r = await fetch(`${origin}/index.html`, { headers: { 'x-og-internal': '1' } });
    if (r.ok) html = await r.text();
  } catch { /* noop */ }
  if (!html.includes('</head>')) {
    // Couldn't load the app shell: send a small page with the preview tags that opens the app.
    // No auto-refresh here: it would loop straight back into this handler.
    html = `<!doctype html><html><head>${meta}</head><body><p><a href="/">Open BetterGovPH Volunteers</a></p></body></html>`;
  } else {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<meta\s+name="description"[^>]*>/i, '').replace('</head>', `${meta}</head>`);
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  res.end(html);
};

// ---------- /teams -----------------------------------------------------------
const TEAM_STATUSES = ['pending', 'approved', 'declined', 'left'];


/** Team role sync needs the member's Discord id; failures are silent by design. */
const discordRowFor = async (client: any, uid: string) => {
  try {
    const { data } = await client.from('users').select('discord_id, status, is_admin').eq('uid', uid).maybeSingle();
    return data ?? null;
  } catch { return null; }
};

const applyTeamRole = async (client: any, projectId: string, userId: string, member: boolean) => {
  const row = await discordRowFor(client, userId);
  if (row) await syncTeamRole(row, projectId, member);
};

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
        name: !u ? 'Member' : isAdmin ? String(u.full_name || '').trim() || 'Member' : canManage || full ? memberNameOf(u) : publicNameOf(u),
        role: u?.specialization || null,
        memberId: u?.member_id || null,
        avatarUrl: discordAvatarOf(u),
        discordUsername: canManage ? u?.discord_username || null : undefined,
        skills: canManage && Array.isArray(u?.skills) ? u.skills.slice(0, 6).map((s: any) => s?.name).filter(Boolean) : undefined,
        ...(canManage ? availabilityOf(u) : {}),
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
        url: safeHttpUrl(normalizeUrl(project.project_url ?? project.url ?? '')), repoUrl: project.repo_url ?? null,
        description: project.description ?? '', stage: project.stage ?? null, projType: project.proj_type ?? null,
        repo: project.repo_stats ?? null,
        // Group chats are for signed-in members only.
        chatUrl: uid ? project.chat_url ?? null : null,
        imported: project.imported === true,
      },
      owner: project.owner_type === 'member' && ownerUser
        ? { type: 'member', name: isAdmin ? ownerUser.full_name : canManage ? memberNameOf(ownerUser) : publicNameOf(ownerUser), userId: canManage ? ownerUser.uid : undefined }
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
    // Only a first request (or a fresh one after a decline) notifies; cancel/re-join loops stay quiet.
    if (!existing || existing.status === 'declined') await notify(supabase, headId, {
      kind: 'team_request', title: `${memberNameOf(me)} asked to join ${quote(project.project_name ?? project.title)}`,
      body: payload.message || undefined, link: `/projects/${project.id}`,
    });
    sendJson(res, 200, { status: 'pending' });
    return;
  }

  if (action === 'cancel' || action === 'leave') {
    if (uid === headId) { sendError(res, 400, 'Hand the team head role to someone else before leaving.'); return; }
    const existing = rows.find((r: any) => r.user_id === uid);
    if (!existing) { sendError(res, 404, 'You’re not on this team'); return; }
    const { error } = await supabase.from('team_members').update({ status: 'left', decided_at: now }).eq('id', existing.id);
    if (error) { sendError(res, 500, 'Couldn’t update your membership'); return; }
    await applyTeamRole(supabase, projectId, uid, false);
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
    await applyTeamRole(supabase, projectId, target.user_id, decision === 'approved');
    const pname = quote(project.project_name ?? project.title);
    await notify(supabase, target.user_id, decision === 'approved'
      ? { kind: 'team_approved', title: `You’re on the team for ${pname}`, body: 'Say hi in the team’s group chat.', link: `/projects/${project.id}` }
      : { kind: 'team_declined', title: `Your request to join ${pname} wasn’t accepted this time`, body: 'Other projects are looking for people.', link: '/opportunities' });
    sendJson(res, 200, { status: decision });
    return;
  }

  if (action === 'remove') {
    const userId = typeof body.userId === 'string' ? body.userId : '';
    if (!userId || userId === headId) { sendError(res, 400, 'Pick a member to remove (not the head).'); return; }
    const { error } = await supabase.from('team_members').update({ status: 'left', decided_at: now }).eq('project_id', projectId).eq('user_id', userId);
    if (error) { sendError(res, 500, 'Couldn’t remove that member'); return; }
    await applyTeamRole(supabase, projectId, userId, false);
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

  if (action === 'set-stage') {
    const stage = typeof body.stage === 'string' && PROJECT_STAGES.includes(body.stage) ? body.stage : '';
    if (!stage) { sendError(res, 400, `stage must be one of: ${PROJECT_STAGES.join(', ')}`); return; }
    const { error } = await supabase.from('project_submissions').update({ stage }).eq('id', projectId);
    if (error) { sendError(res, 500, 'Couldn’t save the stage'); return; }
    try { await invalidateCache('cache:projects:approved'); await invalidateCache('cache:projects:approved:merged'); } catch { /* noop */ }
    sendJson(res, 200, { stage });
    return;
  }

  if (action === 'set-chat') {
    const raw = typeof body.chatUrl === 'string' ? body.chatUrl : '';
    const clean = raw.trim() ? sanitizeChatUrl(raw) : null;
    if (raw.trim() && !clean) { sendError(res, 400, 'Use a Messenger, WhatsApp, Viber, Telegram or Discord invite link.'); return; }
    const { error } = await supabase.from('project_submissions').update({ chat_url: clean }).eq('id', projectId);
    if (error) { sendError(res, 500, 'Couldn’t save the chat link'); return; }
    sendJson(res, 200, { chatUrl: clean });
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

  // Right of access and data portability (RA 10173 Sec. 16(c) and 18): everything held about the caller, in one file.
  if (req.method === 'GET' && getStringParam(req.query?.export) === '1') {
    const safe = async (q: PromiseLike<{ data: any; error: any }>) => {
      try { const r = await q; return r.error ? [] : (r.data ?? []); } catch { return []; }
    };
    const { data: profileRow } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
    // Admins' internal moderation notes and the admin flag are not the member's own data entries.
    const profile = profileRow ? { ...profileRow } : null;
    if (profile) { delete (profile as any).admin_notes; delete (profile as any).is_admin; }
    const [projects, calls, interests, teams, hours, updates, consent, notifications, reports] = await Promise.all([
      safe(supabase.from('project_submissions').select('*').eq('user_id', uid)),
      safe(supabase.from('volunteer_calls').select('*').eq('user_id', uid)),
      safe(supabase.from('call_interests').select('*').eq('user_id', uid)),
      safe(supabase.from('team_members').select('*').eq('user_id', uid)),
      safe(supabase.from('volunteer_hours').select('*').eq('user_id', uid)),
      safe(supabase.from('project_updates').select('*').eq('author_id', uid)),
      safe(supabase.from('consent_log').select('*').eq('user_id', uid)),
      safe(supabase.from('notifications').select('*').eq('user_id', uid)),
      safe(supabase.from('reports').select('id, target_type, target_id, reason, details, status, created_at, resolved_at').eq('reporter_id', uid)),
    ]);
    res.setHeader('Content-Disposition', `attachment; filename="bettergovph-my-data-${new Date().toISOString().slice(0, 10)}.json"`);
    sendJson(res, 200, {
      exportedAt: new Date().toISOString(),
      controller: 'BetterGovPH community (personal information controller)',
      note: 'Everything the BetterGovPH Volunteers portal holds about you (RA 10173: right to access and data portability). Sign-in is handled by Google; your Google account data stays with Google.',
      account: { uid, email },
      profile, projectSubmissions: projects, volunteerCalls: calls, callInterests: interests, teamMemberships: teams,
      volunteerHours: hours, projectUpdates: updates, consentRecords: consent, notifications, reportsFiled: reports,
    });
    return;
  }

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
  // The year drives the member ID (BGPH-YYYY-…), so keep it to the community's real years.
  const thisYear = new Date().getFullYear();
  if (typeof body.yearJoined === 'number' && Number.isInteger(body.yearJoined) && body.yearJoined >= 2025 && body.yearJoined <= thisYear) updates.year_joined = body.yearJoined;
  const skills = sanitizeSkills(body.skills);
  if (skills) updates.skills = skills;
  if (typeof body.experienceLevel === 'string') updates.experience_level = body.experienceLevel.trim().slice(0, 50);
  const links = sanitizeLinks(body.links);
  if (links) updates.links = links;
  if (typeof body.secondarySpecialization === 'string') {
    updates.secondary_specialization = body.secondarySpecialization.trim().slice(0, 100) || null;
  }
  if (typeof body.showInDirectory === 'boolean') updates.show_in_directory = body.showInDirectory;
  if (typeof body.showFullName === 'boolean') updates.show_full_name = body.showFullName;
  if (typeof body.displayName === 'string') updates.display_name = cleanDisplayName(body.displayName) || null;
  // Community roles beyond "Member" (Fellow, Contributor, …) are given by admins, not self-chosen.
  if (typeof body.role === 'string' && body.role.trim().toLowerCase() === 'member') updates.role = 'Member';
  if (body.acceptCoc === true) updates.coc_accepted_at = new Date().toISOString();
  if (Array.isArray(body.availability)) updates.availability = body.availability.filter((v: unknown) => typeof v === 'string' && AVAIL.includes(v as string)).slice(0, 3);
  if (typeof body.hoursPerWeek === 'string') updates.hours_per_week = HOURS_PW.includes(body.hoursPerWeek) ? body.hoursPerWeek : null;
  if (typeof body.region === 'string') updates.region = PH_REGIONS.includes(body.region) ? body.region : null;
  if (Array.isArray(body.languages)) updates.languages = body.languages.filter((v: unknown) => typeof v === 'string' && LANGS.includes(v as string)).slice(0, 8);
  // Right to erasure: the member asks, an admin completes it (approved projects may need a new owner first).
  if (body.requestDeletion === true) { updates.deletion_requested_at = new Date().toISOString(); updates.show_in_directory = false; }
  if (body.requestDeletion === false) updates.deletion_requested_at = null;
  updates.auth_provider = authProviderOf(authData?.user);

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
  // The name and community role on an approved card are what /verify vouches for; only admins change them.
  if (existingUser && String(existingUser.status || '').toLowerCase() === 'approved') { delete updates.full_name; delete updates.role; delete updates.year_joined; }
  if (existingUser) {
    let { data: updatedRows, error: updateError } = await supabase
      .from('users').update(updates).eq('uid', uid).select('*');
    // Before a migration runs, save everything else instead of failing the whole profile.
    if (updateError && isMissingColumnError(updateError)) {
      for (const k of ['links', 'secondary_specialization', 'show_in_directory', 'show_full_name', 'consent_version', 'consent_at', 'consent_purposes', 'deletion_requested_at', 'display_name', 'coc_accepted_at', 'availability', 'hours_per_week', 'region', 'languages']) delete updates[k];
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
    if (consentEvent || 'show_in_directory' in updates || 'show_full_name' in updates || 'display_name' in updates) {
      try { await invalidateCache('cache:volunteers:directory:v2'); } catch { /* noop */ }
    }
    if (updated) {
      // Skills drive the volunteer's Discord roles, so keep them in step with the profile.
      if (Array.isArray(body.skills)) await syncSkillRoles(updated);
      sendJson(res, 200, { user: mapUserRow(updated) });
      return;
    }
  }
  const now = new Date().toISOString();
  const { updated_at: _u, ...sent } = updates;
  const insertRow: Record<string, any> = {
    ...sent,
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
    auth_provider: authProviderOf(authData?.user),
  };
  let { data: insertResult, error: insertError } = await supabase
    .from('users').insert(insertRow).select('*').maybeSingle();
  if (insertError && isMissingColumnError(insertError)) {
    for (const k of ['links', 'secondary_specialization', 'show_in_directory', 'show_full_name', 'consent_version', 'consent_at', 'consent_purposes', 'deletion_requested_at', 'display_name', 'coc_accepted_at', 'availability', 'hours_per_week', 'region', 'languages']) delete insertRow[k];
    ({ data: insertResult, error: insertError } = await supabase.from('users').insert(insertRow).select('*').maybeSingle());
  }
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
    await audit(adminSup, req, callerUid, isAdmin !== undefined ? 'member.admin_rights' : 'member.status', { type: 'user', id: idUid },
      { status: status ?? undefined, isAdmin: isAdmin ?? undefined, note: adminNotes ? true : undefined });
    // Approved members get the community role; declined or demoted members lose it. Skill roles
    // follow the profile they applied with. Both are best effort.
    await syncMemberRoles(data[0]);
    await syncSkillRoles(data[0]);
    if (status === 'Approved') {
      await notify(adminSup, idUid, { kind: 'member_approved', title: 'You’re approved — your Volunteer Card is ready', body: 'You can now join project teams.', link: '/dashboard' });
    } else if (status === 'Declined') {
      await notify(adminSup, idUid, { kind: 'member_declined', title: 'An update on your application', body: 'See the note from the admins on your dashboard.', link: '/dashboard' });
    }
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
      try { await invalidateCache('cache:projects:approved'); await invalidateCache('cache:projects:approved:merged'); await invalidateCache('cache:admin:stats'); }
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
      await audit(adminSup, req, callerUid, 'project.approve', { type: 'project', id }, { note: !!note });
      await notify(adminSup, submission.user_id, {
        kind: 'project_approved', title: `${quote(submission.project_name)} is live`, body: note || 'Its team page is open for sign-ups.', link: `/projects/${submission.id}`,
      });
      sendJson(res, 200, { message: 'Approved submission' });
      return;
    }
    if (action === 'reject') {
      if (!note) { sendError(res, 400, 'Add a short note so the submitter knows what to change.'); return; }
      const { error: rejectError } = await updateWithReview({ status: 'rejected' });
      if (rejectError) { sendError(res, 500, 'Failed to reject submission'); return; }
      await invalidateProjectCache();
      await audit(adminSup, req, callerUid, 'project.send_back', { type: 'project', id });
      await notify(adminSup, submission.user_id, {
        kind: 'project_changes', title: `${quote(submission.project_name)} needs a few changes`, body: note, link: '/dashboard/projects',
      });
      sendJson(res, 200, { message: 'Rejected submission' });
      return;
    }
    if (action === 'update') {
      const updateFields: Record<string, any> = {};
      if (typeof body.project_name === 'string') updateFields.project_name = body.project_name.trim();
      if (typeof body.project_url === 'string') {
        const u = safeHttpUrl(body.project_url.trim());
        if (!u) { sendError(res, 400, 'Use a full web link (https://…).'); return; }
        updateFields.project_url = u;
      }
      if (typeof body.description === 'string') updateFields.description = body.description.trim().slice(0, 4000);
      if (typeof body.proj_type === 'string') updateFields.proj_type = body.proj_type.trim().slice(0, 60);
      if (typeof body.repo_url === 'string') updateFields.repo_url = body.repo_url.trim() && parseGithubRepo(body.repo_url) ? body.repo_url.trim() : null;
      if (typeof body.stage === 'string') updateFields.stage = body.stage.trim() || null;
      if (typeof body.admin_note === 'string') updateFields.admin_note = body.admin_note.trim() || null;
      if (typeof body.status === 'string' && ['pending', 'approved', 'rejected'].includes(body.status)) {
        updateFields.status = body.status;
      }
      if (Object.keys(updateFields).length === 0) { sendError(res, 400, 'No fields to update'); return; }
      const { error: updateError } = await adminSup.from('project_submissions').update(updateFields).eq('id', id);
      if (updateError) { sendError(res, 500, 'Failed to update submission'); return; }
      await invalidateProjectCache();
      await audit(adminSup, req, callerUid, 'project.edit', { type: 'project', id }, { fields: Object.keys(updateFields) });
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
      await audit(adminSup, req, callerUid, deleteUser ? 'project.delete_with_user' : 'project.delete', { type: 'project', id }, { name: submission.project_name });
      sendJson(res, 200, { message: deleteUser ? 'Deleted submission and user' : 'Deleted submission' });
      return;
    }
    sendError(res, 400, 'Unknown action');
    return;
  }

  // Overview: what needs attention, community numbers, role mix and recent activity. Admins only.
  if (req.method === 'GET' && resource === 'overview') {
    if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminSup.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    if (authError || !callerUid) { sendError(res, 401, 'Invalid token'); return; }
    const adminCheck = await assertAdmin(adminSup, callerUid, authData?.user?.email ?? undefined);
    if (!adminCheck.ok) { sendError(res, 403, adminCheck.error); return; }
    const head = (table: string) => adminSup.from(table).select('*', { count: 'exact', head: true });
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const safeCount = async (q: any) => { try { const { count } = await q; return count ?? 0; } catch { return 0; } };
    const [pendingApps, members, pendingProjects, approvedProjects, importedProjects, openCalls, interests7d, openReports, newMembers7d, noConsent] = await Promise.all([
      safeCount(head('users').in('status', ['Pending', 'pending', 'PENDING']).eq('is_admin', false).not('full_name', 'eq', '').not('specialization', 'eq', '')),
      safeCount(head('users').in('status', ['Approved', 'approved', 'APPROVED']).eq('is_admin', false)),
      safeCount(head('project_submissions').in('status', ['pending', 'Pending'])),
      safeCount(head('project_submissions').in('status', ['approved', 'Approved'])),
      safeCount(head('project_submissions').eq('imported', true)),
      safeCount(head('volunteer_calls').eq('status', 'open')),
      safeCount(head('call_interests').neq('status', 'withdrawn').gte('created_at', weekAgo)),
      safeCount(head('reports').eq('status', 'open')),
      safeCount(head('users').eq('is_admin', false).gte('created_at', weekAgo)),
      safeCount(head('users').in('status', ['Approved', 'approved', 'APPROVED']).eq('is_admin', false).is('consent_at', null)),
    ]);
    const { data: roleRows } = await adminSup.from('users').select('specialization, secondary_specialization, status')
      .eq('is_admin', false).not('specialization', 'eq', '').limit(5000);
    const roleCount = new Map<string, number>();
    for (const r of roleRows ?? []) {
      if (r.specialization) roleCount.set(r.specialization, (roleCount.get(r.specialization) ?? 0) + 1);
    }
    const { data: deletions } = await adminSup.from('users').select('uid, full_name, email, member_id, status, deletion_requested_at')
      .not('deletion_requested_at', 'is', null).order('deletion_requested_at', { ascending: true }).limit(50);
    // Recent activity, newest first. Names only; no emails in the feed.
    const [{ data: recentUsers }, { data: recentProjects }, { data: recentCalls }] = await Promise.all([
      adminSup.from('users').select('full_name, status, created_at').eq('is_admin', false).not('full_name', 'eq', '').order('created_at', { ascending: false }).limit(6),
      adminSup.from('project_submissions').select('id, project_name, status, created_at, imported').order('created_at', { ascending: false }).limit(6),
      adminSup.from('volunteer_calls').select('id, title, call_type, created_at').order('created_at', { ascending: false }).limit(6),
    ]);
    const feed = [
      ...(recentUsers ?? []).map((u: any) => ({ kind: 'member', text: `${u.full_name} applied`, status: u.status, at: u.created_at })),
      ...(recentProjects ?? []).map((p: any) => ({ kind: 'project', text: `${p.imported ? 'Imported' : 'Submitted'}: ${p.project_name}`, status: p.status, at: p.created_at, link: `/projects/${p.id}` })),
      ...(recentCalls ?? []).map((c: any) => ({ kind: 'call', text: `${c.call_type && c.call_type !== 'people' ? 'Request' : 'Call'}: ${c.title}`, at: c.created_at, link: `/opportunities?call=${c.id}` })),
    ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 12);
    sendJson(res, 200, {
      queue: { pendingApps, pendingProjects, openReports, deletionRequests: (deletions ?? []).length, noConsent },
      numbers: { members, approvedProjects, importedProjects, openCalls, interests7d, newMembers7d },
      roles: Array.from(roleCount.entries()).sort((a, b) => b[1] - a[1]).map(([role, count]) => ({ role, count })),
      deletions: (deletions ?? []).map((d: any) => ({ uid: d.uid, name: d.full_name, email: d.email, memberId: d.member_id, status: d.status, requestedAt: d.deletion_requested_at })),
      feed,
    });
    return;
  }

  // Erase a member's data after a deletion request (RA 10173, right to erasure). Admins only.
  // Approved public projects stay listed but move to the admin; everything personal is removed.
  if (req.method === 'GET' && resource === 'audit') {
    if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminSup.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    if (authError || !callerUid) { sendError(res, 401, 'Invalid token'); return; }
    const adminCheck = await assertAdmin(adminSup, callerUid, authData?.user?.email ?? undefined);
    if (!adminCheck.ok) { sendError(res, 403, adminCheck.error); return; }
    const { data, error } = await adminSup.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) { sendJson(res, 200, { entries: [] }); return; }
    const ids = Array.from(new Set((data ?? []).map((e: any) => e.actor_id)));
    const { data: actors } = ids.length ? await adminSup.from('users').select('uid, full_name').in('uid', ids) : { data: [] as any[] };
    const nameOf = new Map((actors ?? []).map((a: any) => [String(a.uid), a.full_name]));
    sendJson(res, 200, {
      entries: (data ?? []).map((e: any) => ({
        id: e.id, action: e.action, targetType: e.target_type, targetId: e.target_id, details: e.details, at: e.created_at,
        actor: nameOf.get(String(e.actor_id)) || 'Admin',
      })),
    });
    return;
  }

  if (req.method === 'POST' && resource === 'erase-user') {
    if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminSup.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    if (authError || !callerUid) { sendError(res, 401, 'Invalid token'); return; }
    const adminCheck = await assertAdmin(adminSup, callerUid, authData?.user?.email ?? undefined);
    if (!adminCheck.ok) { sendError(res, 403, adminCheck.error); return; }
    const body = getBody(req);
    const uid = typeof body.uid === 'string' && isUuid(body.uid) ? body.uid : '';
    if (!uid) { sendError(res, 400, 'uid is required'); return; }
    if (uid === callerUid) { sendError(res, 400, 'You can’t erase your own account here.'); return; }
    const { data: target } = await adminSup.from('users').select('uid, is_admin, email, discord_id, deletion_requested_at').eq('uid', uid).maybeSingle();
    if (!target) { sendError(res, 404, 'Member not found'); return; }
    if (target.is_admin) { sendError(res, 400, 'Remove admin rights first.'); return; }
    // Typed confirmation: the member's email, so this can't happen by a stray click.
    if (typeof body.confirm !== 'string' || body.confirm.trim().toLowerCase() !== String(target.email || '').toLowerCase()) {
      sendError(res, 400, 'Type the member’s email to confirm.'); return;
    }
    const done: string[] = [];
    const step = async (label: string, fn: () => PromiseLike<any>) => { try { const r = await fn(); if (!r?.error) done.push(label); } catch { /* table may not exist */ } };
    // Projects they submitted: approved ones stay public under the admin; the rest are deleted.
    await step('projects reassigned', () => adminSup.from('project_submissions').update({ user_id: callerUid, owner_user_id: null }).eq('user_id', uid).in('status', ['approved', 'Approved']));
    await step('team head handed to admin', () => adminSup.from('project_submissions').update({ team_head_id: callerUid }).eq('team_head_id', uid));
    await step('other projects deleted', () => adminSup.from('project_submissions').delete().eq('user_id', uid));
    await step('team memberships', () => adminSup.from('team_members').delete().eq('user_id', uid));
    await step('call interests', () => adminSup.from('call_interests').delete().eq('user_id', uid));
    await step('calls', () => adminSup.from('volunteer_calls').delete().eq('user_id', uid));
    await step('notifications', () => adminSup.from('notifications').delete().eq('user_id', uid));
    await step('reports filed', () => adminSup.from('reports').delete().eq('reporter_id', uid));
    await step('consent records', () => adminSup.from('consent_log').delete().eq('user_id', uid));
    await step('volunteer hours', () => adminSup.from('volunteer_hours').delete().eq('user_id', uid));
    await step('project updates', () => adminSup.from('project_updates').delete().eq('author_id', uid));
    // Take the Discord roles away while the Discord id is still known.
    await syncMemberRoles({ discord_id: target.discord_id, status: 'deleted', is_admin: false });
    await syncSkillRoles({ discord_id: target.discord_id, status: 'deleted', skills: [] });
    const { error: delErr } = await adminSup.from('users').delete().eq('uid', uid);
    if (delErr) { sendError(res, 500, 'Couldn’t remove the profile. Related data may already be removed; try again.'); return; }
    done.push('profile');
    try { await adminSup.auth.admin.deleteUser(uid); done.push('sign-in account'); } catch { /* noop */ }
    try {
      await invalidateCache('cache:admin:stats'); await invalidateCache('cache:volunteers:directory:v2');
      await invalidateCache('cache:projects:approved'); await invalidateCache('cache:projects:approved:merged');
    } catch { /* noop */ }
    await audit(adminSup, req, callerUid, 'member.erase', { type: 'user', id: uid }, { removed: done });
    sendJson(res, 200, { erased: true, removed: done });
    return;
  }

  if (req.method === 'POST' && resource === 'import-projects') {
    if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
    const token = getBearerToken(req.headers?.authorization);
    if (!token) { sendError(res, 401, 'Missing Authorization bearer token'); return; }
    const adminSup = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminSup.auth.getUser(token);
    const callerUid = authData?.user?.id ? String(authData.user.id) : '';
    if (authError || !callerUid) { sendError(res, 401, 'Invalid token'); return; }
    const adminCheck = await assertAdmin(adminSup, callerUid, authData?.user?.email ?? undefined);
    if (!adminCheck.ok) { sendError(res, 403, adminCheck.error); return; }
    const body = getBody(req);
    const list: any[] = Array.isArray(body.projects) ? body.projects.slice(0, 100) : [];
    if (!list.length) { sendError(res, 400, 'Send { projects: [...] } (up to 100).'); return; }
    const { data: existing } = await adminSup.from('project_submissions').select('project_name, project_url');
    const seen = new Set((existing ?? []).flatMap((e: any) => [String(e.project_name || '').toLowerCase().trim(), projectUrlKey(e.project_url)]));
    const STAGES = ['idea', 'building', 'beta', 'live', 'completed', 'needs-lead'];
    const rows: any[] = [];
    const skipped: { name: string; reason: string }[] = [];
    for (const p of list) {
      const name = typeof p?.name === 'string' ? p.name.trim().slice(0, 160) : '';
      const url = safeHttpUrl(typeof p?.url === 'string' ? p.url.trim() : '');
      if (!name || !url) { skipped.push({ name: name || '(no name)', reason: 'needs a name and an https link' }); continue; }
      if (seen.has(name.toLowerCase()) || seen.has(projectUrlKey(url))) { skipped.push({ name, reason: 'already listed' }); continue; }
      seen.add(name.toLowerCase()); seen.add(projectUrlKey(url));
      const repo = typeof p?.repoUrl === 'string' && parseGithubRepo(p.repoUrl) ? p.repoUrl.trim() : parseGithubRepo(url) ? url : null;
      const ownerName = typeof p?.ownerName === 'string' ? p.ownerName.trim().slice(0, 120) : '';
      rows.push({
        id: safeRandomUuid(), user_id: callerUid, team_head_id: callerUid, imported: true, status: 'approved',
        project_name: name, project_url: url,
        description: typeof p?.description === 'string' && p.description.trim() ? p.description.trim().slice(0, 4000) : 'Imported from the BetterGovPH Discord.',
        proj_type: typeof p?.type === 'string' && p.type.trim() ? p.type.trim().slice(0, 60) : 'other',
        repo_url: repo, stage: STAGES.includes(p?.stage) ? p.stage : null,
        chat_url: sanitizeChatUrl(p?.chatUrl),
        owner_type: ownerName ? 'org' : 'member', owner_name: ownerName || null, owner_user_id: ownerName ? null : callerUid,
        reviewed_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await adminSup.from('project_submissions').insert(rows);
      if (error) { sendError(res, 500, 'Import failed. Nothing was added.'); return; }
      await adminSup.from('team_members').insert(rows.map((r) => ({
        project_id: r.id, user_id: callerUid, role: 'head', status: 'approved', decided_at: new Date().toISOString(),
      })));
      try { await invalidateCache('cache:projects:approved'); await invalidateCache('cache:projects:approved:merged'); await invalidateCache('cache:admin:stats'); } catch { /* noop */ }
    }
    await audit(adminSup, req, callerUid, 'projects.import', undefined, { imported: rows.length, skipped: skipped.length });
    sendJson(res, 200, { imported: rows.length, skipped });
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
    await audit(adminSup, req, callerUid, 'privacy.export', undefined, { members: (users ?? []).length });
    sendJson(res, 200, { version: CONSENT_VERSION, members: users ?? [], log: log ?? [] });
    return;
  }

  sendError(res, 400, 'Unknown resource or method');
};

const normalizeUrl = (value: unknown) => typeof value === 'string' ? value.replace(/`/g, '').trim() : '';
const mapProjectRow = (row: any) => ({
  id: row.id, title: row.project_name ?? row.title ?? '',
  description: row.description ?? '', url: safeHttpUrl(normalizeUrl(row.project_url ?? row.url ?? '')),
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

/** Same site written differently (trailing slash, www, http, case) counts as one project. */
const projectUrlKey = (url: unknown) => {
  const raw = String(url || '').trim();
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch { return raw.toLowerCase().replace(/\/+$/, ''); }
};
const dedupeMergedProjects = (local: any[], remote: any[]): any[] => {
  // Portal projects win: they have team pages and repo tracking.
  const map = new Map<string, any>();
  for (const p of local) {
    if (p?.url) map.set(projectUrlKey(p.url), { ...p, source: p.source || 'local' });
  }
  for (const r of remote) {
    const key = projectUrlKey(r?.url);
    if (r?.url && !map.has(key)) map.set(key, r);
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
    if (repoStats.isPrivate) { sendError(res, 400, 'That repository is private. Make it public to track it here.'); return; }
  }
  const chatRaw = typeof body.chat_url === 'string' ? body.chat_url : typeof body.chatUrl === 'string' ? body.chatUrl : '';
  if (chatRaw.trim() && !sanitizeChatUrl(chatRaw)) { sendError(res, 400, 'Use a Messenger, WhatsApp, Viber, Telegram or Discord invite link for the group chat.'); return; }
  const STAGES = ['idea', 'building', 'beta', 'live', 'completed', 'needs-lead'];
  const stage = typeof body.stage === 'string' && STAGES.includes(body.stage) ? body.stage : null;
  const ownerType = body.owner_type === 'org' || body.ownerType === 'org' ? 'org' : 'member';
  const ownerNameRaw = typeof body.owner_name === 'string' ? body.owner_name : typeof body.ownerName === 'string' ? body.ownerName : '';
  const extras: Record<string, any> = {
    repo_url: repoStats ? repoStats.url : null, stage, team_head_id: uid,
    owner_type: ownerType, owner_name: ownerType === 'org' ? ownerNameRaw.trim().slice(0, 120) || null : null,
    owner_user_id: ownerType === 'member' ? uid : null,
    repo_stats: repoStats, repo_checked_at: repoStats?.checkedAt ?? null,
    chat_url: sanitizeChatUrl(body.chat_url ?? body.chatUrl),
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
  if (req.method === 'POST') {
    // Edit and resubmit a project that was sent back (or is still waiting): it goes back to review.
    const caller = await authCaller(req);
    if ('error' in caller) { sendError(res, 500, caller.error); return; }
    const { supabase: sb, uid: me } = caller;
    if (!me) { sendError(res, 401, 'Sign in first'); return; }
    const body = getBody(req);
    const id = typeof body.id === 'string' ? body.id : '';
    const { data: row } = id ? await sb.from('project_submissions').select('*').eq('id', id).maybeSingle() : { data: null };
    if (!row || row.user_id !== me) { sendError(res, 404, 'Submission not found'); return; }
    const st = String(row.status || '').toLowerCase();
    if (st !== 'rejected' && st !== 'pending') { sendError(res, 400, 'Approved projects are edited by the team head or an admin.'); return; }
    const fields: Record<string, any> = { status: 'pending' };
    if (typeof body.projectName === 'string' && body.projectName.trim()) fields.project_name = body.projectName.trim().slice(0, 160);
    if (typeof body.description === 'string' && body.description.trim()) fields.description = body.description.trim().slice(0, 4000);
    if (typeof body.projectUrl === 'string') {
      const u = safeHttpUrl(body.projectUrl.trim());
      if (!u) { sendError(res, 400, 'Use a full web link (https://…) for the project.'); return; }
      fields.project_url = u;
    }
    if (typeof body.repoUrl === 'string') {
      if (body.repoUrl.trim()) {
        const repo = await fetchRepoStats(body.repoUrl.trim());
        if (!repo.ok) { sendError(res, 400, repo.error || 'Couldn’t read that repository.'); return; }
        fields.repo_url = repo.url; fields.repo_stats = repo; fields.repo_checked_at = repo.checkedAt;
      } else fields.repo_url = null;
    }
    const { error } = await sb.from('project_submissions').update(fields).eq('id', id);
    if (error) { sendError(res, 500, 'Couldn’t resubmit. Try again.'); return; }
    await notifyAdmins(sb, { kind: 'project_resubmitted', title: `Resubmitted for review: ${quote(fields.project_name ?? row.project_name)}`, link: '/admin?tab=projects' });
    try { await invalidateCache('cache:admin:stats'); } catch { /* noop */ }
    sendJson(res, 200, { status: 'pending' });
    return;
  }
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
  chatUrl: row.chat_url ?? undefined,
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
  const chat = body.chat_url ?? body.chatUrl;
  if (typeof chat === 'string') {
    const clean = chat.trim() ? sanitizeChatUrl(chat) : null;
    if (chat.trim() && !clean) out.__chatError = true;
    out.chat_url = clean;
  }
  return out;
};

const handler_volunteer_calls: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE' && req.method !== 'PATCH' && req.method !== 'PUT') {
    sendError(res, 405, 'Method not allowed'); return;
  }
  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) { sendError(res, 500, 'Server not configured'); return; }
  const token = getBearerToken(req.headers?.authorization);
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);
  let uid = '';
  if (token) {
    const { data: authData } = await supabase.auth.getUser(token);
    uid = authData?.user?.id ? String(authData.user.id) : '';
  }
  // Browsing open calls needs no account (MVP). Everything else does.
  if (!uid && req.method !== 'GET') { sendError(res, 401, token ? 'Invalid token' : 'Missing Authorization bearer token'); return; }
  const { data: callerRow } = uid ? await supabase.from('users').select('is_admin').eq('uid', uid).maybeSingle() : { data: null };
  const isAdmin = !!callerRow?.is_admin;

  if (req.method === 'GET' && !uid) {
    // Public view: open calls only; no contact details, chat links or emails; posters by public name.
    if (getStringParam(req.query?.mine) || getStringParam(req.query?.admin)) { sendError(res, 401, 'Sign in first'); return; }
    let query: any = supabase.from('volunteer_calls').select('*', { count: 'exact' }).eq('status', 'open').order('created_at', { ascending: false });
    const one = getStringParam(req.query?.id);
    if (one) { if (!isUuid(one)) { sendJson(res, 200, { calls: [], totalCount: 0 }); return; } query = query.eq('id', one); }
    const { data, error, count } = await query.limit(100);
    if (error) { sendError(res, 500, 'Failed to load volunteer calls'); return; }
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: us } = await supabase.from('users').select('*').in('uid', ids);
      for (const u of us ?? []) names.set(String(u.uid), publicNameOf(u));
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Vary', 'Authorization');
    sendJson(res, 200, {
      calls: rows.map((r: any) => {
        const c: any = mapCallRow(r, { fullName: names.get(String(r.user_id)) || 'Member', email: '' });
        delete c.contact; delete c.chatUrl; delete c.userId;
        return { ...c, contactHidden: !!(r.contact || r.chat_url) };
      }),
      totalCount: count ?? 0,
    });
    return;
  }

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
    const one = getStringParam(req.query?.id);
    if (one && isUuid(one)) query = query.eq('id', one);
    const { data, error, count } = await query.limit(100);
    if (error) { sendError(res, 500, 'Failed to load volunteer calls'); return; }
    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    const userMap = new Map<string, { fullName: string; email: string }>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase.from('users').select('*').in('uid', userIds);
      // Emails stay with admins; members see who posted (by display name), and reach them via contact/chat.
      if (usersData) for (const u of usersData) {
        userMap.set(u.uid, { fullName: isAdmin ? u.full_name ?? '' : memberNameOf(u), email: isAdmin ? u.email ?? '' : '' });
      }
    }
    // "I'm interested": my own status on each call, and a count on calls I posted.
    const callIds = rows.map((r: any) => r.id);
    const mineByCall = new Map<string, string>();
    const countByCall = new Map<string, number>();
    if (callIds.length) {
      const { data: ints } = await supabase.from('call_interests').select('call_id, user_id, status').in('call_id', callIds);
      for (const i of ints ?? []) {
        if (i.user_id === uid) mineByCall.set(i.call_id, i.status);
        if (i.status !== 'withdrawn') countByCall.set(i.call_id, (countByCall.get(i.call_id) ?? 0) + 1);
      }
    }
    sendJson(res, 200, {
      calls: rows.map((r: any) => ({
        ...mapCallRow(r, userMap.get(r.user_id)),
        // Members only learn whether a call is theirs, not who else's uid posted it.
        userId: isAdmin || r.user_id === uid ? r.user_id : '',
        myInterest: mineByCall.get(r.id) ?? null,
        interestCount: r.user_id === uid || isAdmin ? countByCall.get(r.id) ?? 0 : undefined,
      })),
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
      .from('volunteer_calls').select('*').eq('id', id).maybeSingle();
    if (callError) { sendError(res, 500, 'Failed to load volunteer call'); return; }
    if (!call) { sendError(res, 404, 'Volunteer call not found'); return; }
    if (!isAdmin && (call as any).user_id !== uid) {
      sendError(res, 403, 'Forbidden: You do not own this volunteer call'); return;
    }
    if (!isAdmin && (call as any).admin_hidden === true && typeof body.status === 'string' && body.status.toLowerCase() === 'open') {
      sendError(res, 403, 'An admin closed this call after a report. Ask an admin to reopen it.'); return;
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
    if (isAdmin && updateFields.status === 'open') updateFields.admin_hidden = false;
    const extras = callExtrasFrom(body);
    if (extras.__chatError) { sendError(res, 400, 'Use a Messenger, WhatsApp, Viber, Telegram or Discord invite link for the group chat.'); return; }
    delete extras.__chatError;
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
  // Posting needs a vetted account: a throwaway login can't post calls to harvest volunteers' details.
  const { data: poster } = await supabase.from('users').select('status').eq('uid', uid).maybeSingle();
  if (!isAdmin && String(poster?.status || '').toLowerCase() !== 'approved') {
    sendError(res, 403, 'You can post calls once your membership is approved.'); return;
  }
  const extras = callExtrasFrom(body);
  if (extras.__chatError) { sendError(res, 400, 'Use a Messenger, WhatsApp, Viber, Telegram or Discord invite link for the group chat.'); return; }
  delete extras.__chatError;
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

  // Cards are read through verify_member(): one exact match, card columns only, never the
  // whole row. Until that function exists (migration not applied) the old read is used.
  const cardFor = async (lookup: string): Promise<{ row: any | null; viaRpc: boolean }> => {
    try {
      const { data, error } = await dbClient.rpc('verify_member', { p_lookup: lookup });
      if (error) return { row: null, viaRpc: false };
      return { row: Array.isArray(data) ? data[0] ?? null : data ?? null, viaRpc: true };
    } catch { return { row: null, viaRpc: false }; }
  };

  if (token && serviceKey) {
    try {
      const { data: authData } = await dbClient.auth.getUser(token);
      if (authData?.user) {
        callerUid = authData.user.id;
        const caller = await cardFor(callerUid);
        if (caller.viaRpc) isAdminCaller = !!caller.row?.is_admin;
        else {
          const { data: callerRow } = await dbClient
            .from('users').select('is_admin').eq('uid', callerUid).maybeSingle();
          isAdminCaller = !!callerRow?.is_admin;
        }
      }
    } catch { isAdminCaller = false; }
  }

  const cleanLookup = lookupRaw.trim();
  const lookupUpper = cleanLookup.toUpperCase();
  const exactMemberId = lookupUpper.startsWith('BGPH-') ? lookupUpper : `BGPH-${lookupUpper}`;
  // Only a full member ID (BGPH-2026-001) or a uid is accepted. Anything else is never put in a query,
  // so a visitor can't add their own filters (e.g. ",email.eq.someone@x") or enumerate members.
  if (!isSafeMemberId(exactMemberId) && !isUuid(cleanLookup)) { sendError(res, 404, 'Not found'); return; }

  // A uid lookup only answers the member themself or an admin.
  const lookupValue = isSafeMemberId(exactMemberId)
    ? exactMemberId
    : (isAdminCaller || callerUid === cleanLookup ? cleanLookup : '');
  if (!lookupValue) { sendError(res, 404, 'Not found'); return; }

  let row: any | null = null;

  const card = await cardFor(lookupValue);
  row = card.row;

  if (!row && !card.viaRpc) {
    const { data: memberData } = await dbClient
      .from('users')
      .select('*')
      .eq('member_id', isSafeMemberId(exactMemberId) ? exactMemberId : '__none__')
      .maybeSingle();
    row = memberData ?? null;
    if (!row && lookupValue === cleanLookup) {
      const { data: uidData } = await dbClient
        .from('users')
        .select('*')
        .eq('uid', cleanLookup).maybeSingle();
      row = uidData ?? null;
    }
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
    confirmedHours: await (async () => {
      try {
        const { data: hrs } = await dbClient.from('volunteer_hours').select('hours').eq('user_id', row.uid).eq('status', 'confirmed');
        return (hrs ?? []).reduce((a: number, h: any) => a + Number(h.hours), 0);
      } catch { return 0; }
    })(),
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
    if (!bettygoBaseUrl) {
      if (req.method === 'GET') { sendJson(res, 200, { connected: false }); return; }
      sendError(res, 503, 'Discord sign-in is not configured');
      return;
    }
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
      if (verified && discordAutoApprove()) {
        const { data: currentUser } = await supabase.from('users').select('status').eq('uid', uid).maybeSingle();
        if (currentUser && currentUser.status !== 'Approved') {
          await supabase.from('users').update({ status: 'Approved', updated_at: new Date().toISOString() }).eq('uid', uid);
          try { await ensureUserHasMemberId(supabase, uid); } catch { /* noop */ }
        }
      }
      if (verified) {
        // Status checks run on every dashboard load, so roles are synced once, the first time the member
        // shows up as verified. Approvals, declines and admin changes sync on their own.
        const { data: after } = await supabase.from('users').select('discord_id, status, is_admin, discord_verified, skills').eq('uid', uid).maybeSingle();
        if (after && after.discord_verified !== true) {
          await supabase.from('users').update({ discord_verified: true }).eq('uid', uid);
          await syncMemberRoles(after);
          await syncSkillRoles(after);
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
        // Only our own origins; anything else falls back to the configured callback (or bettygo's default).
        const redirectUri = callbackUrl || (origin && isAllowedOrigin(origin) ? `${origin}/discord-callback` : '');
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
        if (verified && discordAutoApprove()) updateFields.status = 'Approved';
        await supabase.from('users').update(updateFields).eq('uid', uid);
        let memberId: string | null = null;
        if (verified && discordAutoApprove()) { try { memberId = await ensureUserHasMemberId(supabase, uid); } catch { /* noop */ } }
        if (verified) {
          const { data: after } = await supabase.from('users').select('discord_id, status, is_admin, skills').eq('uid', uid).maybeSingle();
          if (after) { await syncMemberRoles(after); await syncSkillRoles(after); }
        }
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
  const { url: supabaseUrl, anonKey, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || (!anonKey && !serviceKey)) { sendError(res, 500, 'Server not configured'); return; }
  const usernameRaw = getStringParam(req.query?.username);
  const username = (usernameRaw ?? '').trim();
  if (!username || username.length < 2 || username.length > 64) {
    sendError(res, 400, 'Invalid username'); return;
  }
  // Table access is revoked for the public roles, so the availability check goes through
  // discord_username_taken(); the anon read stays as the pre-migration fallback.
  if (serviceKey) {
    const svc = createServiceClient(supabaseUrl, serviceKey);
    const { data: takenData, error: takenError } = await svc.rpc('discord_username_taken', { p_username: username });
    if (!takenError) { sendJson(res, 200, { taken: takenData === true }); return; }
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
  const { data: caller } = await supabase.from('users').select('is_admin').eq('uid', authData.user.id).maybeSingle();
  if (!caller?.is_admin) { sendError(res, 403, 'Admin only'); return; }
  const githubToken = process.env.GITHUB_TOKEN ?? '';
  if (!githubToken) { sendError(res, 500, 'Server not configured'); return; }
  try {
    const cached = await getCache<any>('cache:contribution-scores').catch(() => null);
    if (cached) { sendJson(res, 200, cached); return; }
    const scores = await getContributionScores(githubToken);
    try { await setCache('cache:contribution-scores', { scores, generatedAt: new Date().toISOString() }, 3600); } catch { /* noop */ }
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
  const volunteers = (data ?? []).filter((r: any) =>
    r.show_in_directory !== false && Array.isArray(r.consent_purposes) && r.consent_purposes.includes('directory')).map((r: any) => {
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

// ---------- /contributors (public) ---------------------------------------------
// People who built this portal. GitHub's /contributors list is computed lazily and can lag (after the
// history rewrite it dropped some authors), so it's merged with the commit authors on the default
// branch. Built once an hour on the server with GITHUB_TOKEN, so visitors never spend their own
// 60-an-hour unauthenticated GitHub quota.
const PORTAL_REPO = 'johnkylledev/BetterGovPH-Volunteers-Portal';
const CONTRIBUTORS_CACHE = 'cache:contributors:v2';
const NON_HUMAN_LOGIN = /\[bot\]$|^(dependabot|renovate|github-actions|copilot|claude|anthropic|codex|devin|cursor)/i;

const githubHeaders = (): Record<string, string> => {
  const token = process.env.GITHUB_TOKEN ?? '';
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'bettergovph-volunteers-portal',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

type ContributorRow = { login: string; avatar: string; url: string; contributions: number };

const buildContributors = async () => {
  const headers = githubHeaders();
  const people = new Map<string, ContributorRow>();
  const isPerson = (u: any) => !!u?.login && u.type === 'User' && !NON_HUMAN_LOGIN.test(u.login);
  // Every commit on the default branch (up to 1,000), counted by linked GitHub author.
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(`https://api.github.com/repos/${PORTAL_REPO}/commits?per_page=100&page=${page}`, { headers, signal: AbortSignal.timeout(8000) });
    if (!r.ok) { if (page === 1) throw new Error(`GitHub commits ${r.status}`); break; }
    const list = (await r.json()) as any[];
    for (const c of list) {
      if (!isPerson(c.author)) continue;
      const cur = people.get(c.author.login);
      if (cur) cur.contributions += 1;
      else people.set(c.author.login, { login: c.author.login, avatar: c.author.avatar_url, url: c.author.html_url, contributions: 1 });
    }
    if (list.length < 100) break;
  }
  // GitHub's own list fills in anyone the commit walk missed; the larger count wins.
  try {
    const r = await fetch(`https://api.github.com/repos/${PORTAL_REPO}/contributors?per_page=100`, { headers, signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      for (const c of (await r.json()) as any[]) {
        if (!isPerson(c)) continue;
        const cur = people.get(c.login);
        if (cur) cur.contributions = Math.max(cur.contributions, c.contributions);
        else people.set(c.login, { login: c.login, avatar: c.avatar_url, url: c.html_url, contributions: c.contributions });
      }
    }
  } catch { /* commits alone are enough */ }

  const sorted = [...people.values()]
    .sort((a, b) => b.contributions - a.contributions || a.login.localeCompare(b.login))
    .slice(0, 60);
  // Display names live on each profile; fall back to the login.
  const contributors = await Promise.all(sorted.map(async (p) => {
    let name: string | null = null;
    try {
      const r = await fetch(`https://api.github.com/users/${encodeURIComponent(p.login)}`, { headers, signal: AbortSignal.timeout(5000) });
      if (r.ok) name = ((await r.json()) as any).name ?? null;
    } catch { /* the login is fine */ }
    return {
      login: p.login,
      name,
      avatarUrl: `${p.avatar}${String(p.avatar).includes('?') ? '&' : '?'}s=96`,
      profileUrl: safeHttpUrl(p.url) || `https://github.com/${encodeURIComponent(p.login)}`,
      contributions: p.contributions,
    };
  }));
  return { contributors, generatedAt: new Date().toISOString() };
};

const handler_contributors: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  if (req.method !== 'GET') { sendError(res, 405, 'Method not allowed'); return; }
  try { const cached = await getCache<any>(CONTRIBUTORS_CACHE); if (cached) { sendJson(res, 200, cached); return; } }
  catch { /* noop */ }
  try {
    const payload = await buildContributors();
    try { await setCache(CONTRIBUTORS_CACHE, payload, 3600); } catch { /* noop */ }
    sendJson(res, 200, payload);
  } catch (err) {
    console.error('[contributors]', err instanceof Error ? err.message : err);
    sendError(res, 502, 'Could not reach GitHub');
  }
};

type HandlerKey =
  | '/me' | '/admin' | '/projects' | '/submit-project' | '/my-project-submissions'
  | '/volunteer-calls' | '/verify' | '/discord' | '/discord-username-taken' | '/contribution-scores' | '/volunteers'
  | '/repo-tracker' | '/teams' | '/cron/repo-sync' | '/call-interests' | '/notifications' | '/reports'
  | '/hours' | '/certificate' | '/project-updates' | '/og' | '/contributors';

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
  '/contributors': handler_contributors,
  '/repo-tracker': handler_repo_tracker,
  '/teams': handler_teams,
  '/cron/repo-sync': handler_cron_repo_sync,
  '/call-interests': handler_call_interests,
  '/notifications': handler_notifications,
  '/reports': handler_reports,
  '/hours': handler_hours,
  '/certificate': handler_certificate,
  '/project-updates': handler_project_updates,
  '/og': handler_og,
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
    try { res.setHeader('X-API-Version', LIB_API_VERSION); } catch { /* headers already sent */ }
    const pathname = normalizePath(req);
    applyCors(req, res, pathname);

    if (bootFailure) { sendError(res, 500, 'Internal server error'); return; }

    if (req.method === 'OPTIONS') {
      try { res.statusCode = 204; res.end(); } catch { /* noop */ }
      return;
    }

    // Writes must be JSON and small; a browser from another site can't post here.
    const method = String(req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      const len = Number(req.headers?.['content-length'] || 0);
      if (len > MAX_BODY_BYTES) { sendError(res, 413, 'Request too large'); return; }
      const ctype = String(req.headers?.['content-type'] || '');
      if (len > 0 && !ctype.toLowerCase().includes('application/json')) { sendError(res, 415, 'Send JSON'); return; }
      const origin = String(req.headers?.origin || '');
      if (origin && !isAllowedOrigin(origin) && pathname !== '/cron/repo-sync') { sendError(res, 403, 'Origin not allowed'); return; }
    }

    if (!(await enforceRateLimits(req, res, pathname))) return;

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
    if (pathname === '/contributors') return callHandler('/contributors', req, res);
    if (pathname === '/repo-tracker') return callHandler('/repo-tracker', req, res);
    if (pathname === '/teams') return callHandler('/teams', req, res);
    if (pathname === '/cron/repo-sync') return callHandler('/cron/repo-sync', req, res);
    if (pathname === '/call-interests') return callHandler('/call-interests', req, res);
    if (pathname === '/notifications') return callHandler('/notifications', req, res);
    if (pathname === '/reports') return callHandler('/reports', req, res);
    if (pathname === '/hours') return callHandler('/hours', req, res);
    if (pathname === '/certificate') return callHandler('/certificate', req, res);
    if (pathname === '/project-updates') return callHandler('/project-updates', req, res);
    if (pathname === '/og') return callHandler('/og', req, res);

    sendError(res, 404, 'API endpoint not found');
  } catch (err) {
    console.error('[API][request-error]', { path: req.url, error: err });
    sendError(res, 500, 'Internal server error');
  }
}

export default handleRequest;
