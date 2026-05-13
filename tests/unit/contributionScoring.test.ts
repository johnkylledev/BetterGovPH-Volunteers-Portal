import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchProjects,
  extractRepos,
  fetchRepoContributions,
  aggregateContributions,
  scoreContributors,
  type ExternalProject,
  type GithubRepo,
  type ContributorStats,
} from '../../api/_lib/contributionScoring';

// ── Helpers ────────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function mockGithubFetch(
  commitPages: Array<{ login: string | null }[]>,
  prNodes: Array<{ login: string | null; reviewLogins: (string | null)[] }>,
  issueLogins: (string | null)[],
) {
  let commitPage = 0;

  return vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { query?: string };
    const q = body.query ?? '';

    if (q.includes('history(')) {
      const page = commitPages[commitPage] ?? [];
      const isLast = commitPage >= commitPages.length - 1;
      commitPage++;
      return jsonResponse({
        data: {
          repository: {
            defaultBranchRef: {
              target: {
                history: {
                  nodes: page.map((n) => ({ author: { user: n.login ? { login: n.login } : null } })),
                  pageInfo: { hasNextPage: !isLast, endCursor: isLast ? null : `cursor-${commitPage}` },
                },
              },
            },
          },
        },
      });
    }

    if (q.includes('pullRequests(')) {
      return jsonResponse({
        data: {
          repository: {
            pullRequests: {
              nodes: prNodes.map((n) => ({
                author: n.login ? { login: n.login } : null,
                reviews: {
                  nodes: n.reviewLogins.map((r) => ({ author: r ? { login: r } : null })),
                },
              })),
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      });
    }

    if (q.includes('issues(')) {
      return jsonResponse({
        data: {
          repository: {
            issues: {
              nodes: issueLogins.map((l) => ({ author: l ? { login: l } : null })),
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      });
    }

    throw new Error(`Unexpected fetch to: ${_url}`);
  });
}

// ── extractRepos ───────────────────────────────────────────────────────────────

describe('extractRepos', () => {
  it('parses valid github.com URLs', () => {
    const projects: ExternalProject[] = [
      { slug: 'a', title: 'A', repositoryUrls: ['https://github.com/bettergovph/govchain'] },
    ];
    expect(extractRepos(projects)).toEqual([{ owner: 'bettergovph', name: 'govchain' }]);
  });

  it('ignores non-GitHub URLs', () => {
    const projects: ExternalProject[] = [
      {
        slug: 'a', title: 'A',
        repositoryUrls: ['https://gitlab.com/foo/bar', 'https://example.com/repo'],
      },
    ];
    expect(extractRepos(projects)).toEqual([]);
  });

  it('deduplicates the same repo across multiple projects', () => {
    const projects: ExternalProject[] = [
      { slug: 'a', title: 'A', repositoryUrls: ['https://github.com/org/repo'] },
      { slug: 'b', title: 'B', repositoryUrls: ['https://github.com/org/repo'] },
    ];
    expect(extractRepos(projects)).toHaveLength(1);
  });

  it('handles repos with .git suffix', () => {
    const projects: ExternalProject[] = [
      { slug: 'a', title: 'A', repositoryUrls: ['https://github.com/org/repo.git'] },
    ];
    expect(extractRepos(projects)).toEqual([{ owner: 'org', name: 'repo' }]);
  });

  it('collects repos from multiple projects', () => {
    const projects: ExternalProject[] = [
      { slug: 'a', title: 'A', repositoryUrls: ['https://github.com/org/alpha', 'https://github.com/org/beta'] },
      { slug: 'b', title: 'B', repositoryUrls: ['https://github.com/org/gamma'] },
    ];
    expect(extractRepos(projects)).toHaveLength(3);
  });
});

// ── scoreContributors ─────────────────────────────────────────────────────────

describe('scoreContributors', () => {
  it('applies formula: commits*1 + prs*5 + reviews*3 + issues*2', () => {
    const agg = new Map<string, ContributorStats>([
      ['alice', { login: 'alice', commits: 10, prs: 2, reviews: 1, issues: 4, repos: ['a/b'] }],
    ]);
    const [score] = scoreContributors(agg);
    // 10*1 + 2*5 + 1*3 + 4*2 = 10 + 10 + 3 + 8 = 31
    expect(score.score).toBe(31);
  });

  it('sorts descending by score', () => {
    const agg = new Map<string, ContributorStats>([
      ['low', { login: 'low', commits: 1, prs: 0, reviews: 0, issues: 0, repos: [] }],
      ['high', { login: 'high', commits: 0, prs: 10, reviews: 0, issues: 0, repos: [] }],
      ['mid', { login: 'mid', commits: 0, prs: 0, reviews: 5, issues: 0, repos: [] }],
    ]);
    const scores = scoreContributors(agg);
    expect(scores[0].login).toBe('high');  // 50
    expect(scores[1].login).toBe('mid');   // 15
    expect(scores[2].login).toBe('low');   // 1
  });

  it('returns zero-score contributors', () => {
    const agg = new Map<string, ContributorStats>([
      ['ghost', { login: 'ghost', commits: 0, prs: 0, reviews: 0, issues: 0, repos: [] }],
    ]);
    const scores = scoreContributors(agg);
    expect(scores).toHaveLength(1);
    expect(scores[0].score).toBe(0);
  });
});

// ── aggregateContributions ────────────────────────────────────────────────────

describe('aggregateContributions', () => {
  it('sums counts for the same contributor across two repos', () => {
    const repoA: GithubRepo = { owner: 'org', name: 'alpha' };
    const repoB: GithubRepo = { owner: 'org', name: 'beta' };
    const statsA = new Map<string, ContributorStats>([
      ['alice', { login: 'alice', commits: 3, prs: 1, reviews: 0, issues: 1, repos: ['org/alpha'] }],
    ]);
    const statsB = new Map<string, ContributorStats>([
      ['alice', { login: 'alice', commits: 2, prs: 0, reviews: 2, issues: 0, repos: ['org/beta'] }],
    ]);
    const agg = aggregateContributions([
      { repo: repoA, stats: statsA },
      { repo: repoB, stats: statsB },
    ]);
    const alice = agg.get('alice')!;
    expect(alice.commits).toBe(5);
    expect(alice.prs).toBe(1);
    expect(alice.reviews).toBe(2);
    expect(alice.issues).toBe(1);
  });

  it('lists each repo slug once in repos[]', () => {
    const repo: GithubRepo = { owner: 'org', name: 'repo' };
    const stats = new Map<string, ContributorStats>([
      ['bob', { login: 'bob', commits: 1, prs: 0, reviews: 0, issues: 0, repos: ['org/repo'] }],
    ]);
    const agg = aggregateContributions([
      { repo, stats },
      { repo, stats },
    ]);
    expect(agg.get('bob')!.repos).toEqual(['org/repo']);
  });

  it('keeps different contributors separate', () => {
    const repo: GithubRepo = { owner: 'org', name: 'repo' };
    const stats = new Map<string, ContributorStats>([
      ['alice', { login: 'alice', commits: 5, prs: 0, reviews: 0, issues: 0, repos: [] }],
      ['bob', { login: 'bob', commits: 3, prs: 0, reviews: 0, issues: 0, repos: [] }],
    ]);
    const agg = aggregateContributions([{ repo, stats }]);
    expect(agg.size).toBe(2);
    expect(agg.get('alice')!.commits).toBe(5);
    expect(agg.get('bob')!.commits).toBe(3);
  });
});

// ── fetchProjects ──────────────────────────────────────────────────────────────

describe('fetchProjects', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses { projects: [...] } response shape', async () => {
    const projects = [{ slug: 'a', title: 'A', repositoryUrls: ['https://github.com/org/repo'] }];
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ projects })));
    const result = await fetchProjects('https://example.com/projects.json');
    expect(result).toEqual(projects);
  });

  it('parses bare array response shape', async () => {
    const projects = [{ slug: 'a', title: 'A', repositoryUrls: [] }];
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse(projects)));
    const result = await fetchProjects('https://example.com/projects.json');
    expect(result).toEqual(projects);
  });

  it('throws on non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({}, 404)));
    await expect(fetchProjects('https://example.com/projects.json')).rejects.toThrow('404');
  });

  it('throws on unexpected response shape', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ data: 'nope' })));
    await expect(fetchProjects('https://example.com/projects.json')).rejects.toThrow('Unexpected');
  });
});

// ── fetchRepoContributions ────────────────────────────────────────────────────

describe('fetchRepoContributions', () => {
  const repo: GithubRepo = { owner: 'bettergovph', name: 'govchain' };
  afterEach(() => vi.restoreAllMocks());

  it('returns correct stats from a single-page response', async () => {
    vi.stubGlobal(
      'fetch',
      mockGithubFetch(
        [[{ login: 'alice' }, { login: 'bob' }, { login: 'alice' }]],
        [{ login: 'alice', reviewLogins: ['bob'] }],
        ['alice', 'carol'],
      ),
    );
    const stats = await fetchRepoContributions(repo, 'token');
    expect(stats.get('alice')?.commits).toBe(2);
    expect(stats.get('bob')?.commits).toBe(1);
    expect(stats.get('alice')?.prs).toBe(1);
    expect(stats.get('bob')?.reviews).toBe(1);
    expect(stats.get('alice')?.issues).toBe(1);
    expect(stats.get('carol')?.issues).toBe(1);
  });

  it('follows commit pagination cursors', async () => {
    const mockFetch = mockGithubFetch(
      [[{ login: 'alice' }], [{ login: 'alice' }]],
      [],
      [],
    );
    vi.stubGlobal('fetch', mockFetch);
    const stats = await fetchRepoContributions(repo, 'token');
    expect(stats.get('alice')?.commits).toBe(2);
    const commitCalls = (mockFetch.mock.calls as [string, RequestInit][]).filter(([, init]) =>
      (JSON.parse(String(init?.body ?? '{}')).query ?? '').includes('history('),
    );
    expect(commitCalls).toHaveLength(2);
  });

  it('ignores null authors', async () => {
    vi.stubGlobal(
      'fetch',
      mockGithubFetch(
        [[{ login: null }, { login: 'alice' }]],
        [{ login: null, reviewLogins: [null] }],
        [null, 'bob'],
      ),
    );
    const stats = await fetchRepoContributions(repo, 'token');
    expect(stats.has('alice')).toBe(true);
    expect(stats.has('bob')).toBe(true);
    expect(stats.size).toBe(2);
  });
});
