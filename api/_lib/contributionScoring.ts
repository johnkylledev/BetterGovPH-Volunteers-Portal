const GITHUB_GRAPHQL = 'https://api.github.com/graphql';
const DEFAULT_PROJECTS_URL = 'https://bettergov.ph/api/projects.json';

export interface ExternalProject {
  slug: string;
  title: string;
  repositoryUrls: string[];
  [key: string]: unknown;
}

export interface GithubRepo {
  owner: string;
  name: string;
}

export interface ContributorStats {
  login: string;
  commits: number;
  prs: number;
  reviews: number;
  issues: number;
  repos: string[];
}

export interface ContributorScore extends ContributorStats {
  score: number;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function fetchProjects(url: string): Promise<ExternalProject[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  const data = await res.json() as unknown;
  if (Array.isArray(data)) return data as ExternalProject[];
  if (data && typeof data === 'object' && Array.isArray((data as any).projects))
    return (data as any).projects as ExternalProject[];
  throw new Error('Unexpected projects response shape');
}

const GITHUB_REPO_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/;

export function extractRepos(projects: ExternalProject[]): GithubRepo[] {
  const seen = new Set<string>();
  const repos: GithubRepo[] = [];
  for (const project of projects) {
    for (const rawUrl of project.repositoryUrls ?? []) {
      const match = String(rawUrl).match(GITHUB_REPO_RE);
      if (!match) continue;
      const key = `${match[1]}/${match[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      repos.push({ owner: match[1], name: match[2] });
    }
  }
  return repos;
}

// ── GitHub GraphQL ─────────────────────────────────────────────────────────────

async function githubGraphql(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<any> {
  const res = await fetch(GITHUB_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL HTTP ${res.status}`);
  const json = await res.json() as { data?: any; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(`GitHub GraphQL: ${json.errors[0].message}`);
  return json.data;
}

const COMMITS_QUERY = `
  query($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 100, after: $cursor) {
              nodes { author { user { login } } }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      }
    }
  }
`;

const PRS_QUERY = `
  query($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(first: 100, after: $cursor, states: [OPEN, MERGED, CLOSED]) {
        nodes {
          author { login }
          reviews(first: 100) {
            nodes { author { login } }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const ISSUES_QUERY = `
  query($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      issues(first: 100, after: $cursor) {
        nodes { author { login } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

function getOrCreate(
  map: Map<string, ContributorStats>,
  login: string,
  repo: GithubRepo,
): ContributorStats {
  if (!map.has(login)) {
    map.set(login, {
      login,
      commits: 0,
      prs: 0,
      reviews: 0,
      issues: 0,
      repos: [`${repo.owner}/${repo.name}`],
    });
  }
  return map.get(login)!;
}

async function fetchAllCommits(
  repo: GithubRepo,
  token: string,
  stats: Map<string, ContributorStats>,
): Promise<void> {
  let cursor: string | null = null;
  do {
    const data = await githubGraphql(COMMITS_QUERY, { ...repo, cursor }, token);
    const history = data?.repository?.defaultBranchRef?.target?.history;
    if (!history) break;
    for (const node of history.nodes ?? []) {
      const login: string | undefined = node?.author?.user?.login;
      if (!login) continue;
      getOrCreate(stats, login, repo).commits++;
    }
    cursor = history.pageInfo?.hasNextPage ? history.pageInfo.endCursor : null;
  } while (cursor);
}

async function fetchAllPRs(
  repo: GithubRepo,
  token: string,
  stats: Map<string, ContributorStats>,
): Promise<void> {
  let cursor: string | null = null;
  do {
    const data = await githubGraphql(PRS_QUERY, { ...repo, cursor }, token);
    const prs = data?.repository?.pullRequests;
    if (!prs) break;
    for (const node of prs.nodes ?? []) {
      const prLogin: string | undefined = node?.author?.login;
      if (prLogin) getOrCreate(stats, prLogin, repo).prs++;
      for (const review of node?.reviews?.nodes ?? []) {
        const reviewLogin: string | undefined = review?.author?.login;
        if (reviewLogin) getOrCreate(stats, reviewLogin, repo).reviews++;
      }
    }
    cursor = prs.pageInfo?.hasNextPage ? prs.pageInfo.endCursor : null;
  } while (cursor);
}

async function fetchAllIssues(
  repo: GithubRepo,
  token: string,
  stats: Map<string, ContributorStats>,
): Promise<void> {
  let cursor: string | null = null;
  do {
    const data = await githubGraphql(ISSUES_QUERY, { ...repo, cursor }, token);
    const issues = data?.repository?.issues;
    if (!issues) break;
    for (const node of issues.nodes ?? []) {
      const login: string | undefined = node?.author?.login;
      if (login) getOrCreate(stats, login, repo).issues++;
    }
    cursor = issues.pageInfo?.hasNextPage ? issues.pageInfo.endCursor : null;
  } while (cursor);
}

export async function fetchRepoContributions(
  repo: GithubRepo,
  token: string,
): Promise<Map<string, ContributorStats>> {
  const stats = new Map<string, ContributorStats>();
  await Promise.all([
    fetchAllCommits(repo, token, stats),
    fetchAllPRs(repo, token, stats),
    fetchAllIssues(repo, token, stats),
  ]);
  return stats;
}

// ── Aggregation & Scoring ──────────────────────────────────────────────────────

export function aggregateContributions(
  entries: Array<{ repo: GithubRepo; stats: Map<string, ContributorStats> }>,
): Map<string, ContributorStats> {
  const global = new Map<string, ContributorStats>();
  for (const { repo, stats } of entries) {
    const slug = `${repo.owner}/${repo.name}`;
    for (const [login, s] of stats) {
      if (!global.has(login)) {
        global.set(login, { login, commits: 0, prs: 0, reviews: 0, issues: 0, repos: [] });
      }
      const g = global.get(login)!;
      g.commits += s.commits;
      g.prs += s.prs;
      g.reviews += s.reviews;
      g.issues += s.issues;
      if (!g.repos.includes(slug)) g.repos.push(slug);
    }
  }
  return global;
}

export function scoreContributors(agg: Map<string, ContributorStats>): ContributorScore[] {
  return Array.from(agg.values())
    .map((s) => ({
      ...s,
      score: s.commits * 1 + s.prs * 5 + s.reviews * 3 + s.issues * 2,
    }))
    .sort((a, b) => b.score - a.score);
}

// ── Concurrency helper ──────────────────────────────────────────────────────────

async function concurrentMap<T, U>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

export async function getContributionScores(
  githubToken: string,
  projectsUrl: string = DEFAULT_PROJECTS_URL,
): Promise<ContributorScore[]> {
  const projects = await fetchProjects(projectsUrl);
  const repos = extractRepos(projects);
  const repoResults = await concurrentMap(repos, 5, async (repo) => {
    const stats = await fetchRepoContributions(repo, githubToken);
    return { repo, stats };
  });
  const agg = aggregateContributions(repoResults);
  return scoreContributors(agg);
}
