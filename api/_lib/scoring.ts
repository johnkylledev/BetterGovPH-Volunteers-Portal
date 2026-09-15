/**
 * api/_lib/scoring.ts
 * GitHub GraphQL fetching and contribution scoring calculation engine
 */

import type { ExternalProject, GithubRepo, ContributorStats, ContributorScore } from './types';

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
    if (owner === 'sponsors' || owner === 'features' || owner === 'topics' || owner.length < 2 || name.length < 2)
      return;
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
    for (const n of nodes) {
      const l = n?.author?.user?.login;
      if (l) logins.push(String(l));
    }
    if (!h?.pageInfo?.hasNextPage) break;
    cursor = h.pageInfo.endCursor ?? null;
    if (!cursor) break;
  }
  return logins;
}

async function fetchPrsAndReviews(
  owner: string,
  repo: string,
  token: string,
): Promise<{ prLogins: string[]; reviewLogins: string[] }> {
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
    const l = n?.author?.login;
    if (l) prLogins.push(String(l));
    const rns: any[] = n?.reviews?.nodes ?? [];
    for (const r of rns) {
      const rl = r?.author?.login;
      if (rl) reviewLogins.push(String(rl));
    }
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
  for (const n of nodes) {
    const l = n?.author?.login;
    if (l) out.push(String(l));
  }
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

function aggregateContributions(
  entries: Array<{ repo: GithubRepo; stats: Map<string, ContributorStats> }>,
): Map<string, ContributorStats> {
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

export async function getContributionScores(
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
        try {
          results.push({ repo: repos[i], stats: await fetchRepoContributions(repos[i], githubToken) });
        } catch {
          /* noop */
        }
      }
    }),
  );
  return scoreContributors(aggregateContributions(results));
}
