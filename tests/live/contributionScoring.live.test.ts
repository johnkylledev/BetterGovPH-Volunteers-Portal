import { describe, it, expect } from 'vitest';
import {
  fetchProjects,
  extractRepos,
  fetchRepoContributions,
  getContributionScores,
  type ExternalProject,
} from '../../api/_lib/contributionScoring';

const token = process.env.GITHUB_TOKEN ?? '';

describe.skipIf(!token)('contribution scoring — live', () => {
  const PROJECTS_URL = 'https://bettergov.ph/api/projects.json';

  it('fetches real projects with repositoryUrls', async () => {
    const projects = await fetchProjects(PROJECTS_URL);

    console.log('\n── Raw projects response (first 3) ──────────────────');
    console.log(JSON.stringify(projects.slice(0, 3), null, 2));
    console.log(`\nTotal projects: ${projects.length}`);

    const repos = extractRepos(projects);
    console.log('\n── Extracted GitHub repos ───────────────────────────');
    repos.forEach((r, i) => console.log(`  ${i + 1}. ${r.owner}/${r.name}`));

    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);

    const withRepos = projects.filter(
      (p: ExternalProject) => Array.isArray(p.repositoryUrls) && p.repositoryUrls.length > 0,
    );
    expect(withRepos.length).toBeGreaterThan(0);
    expect(repos.length).toBeGreaterThan(0);
  });

  it('fetches real contributions for one repo', async () => {
    const projects = await fetchProjects(PROJECTS_URL);
    const repos = extractRepos(projects);
    expect(repos.length).toBeGreaterThan(0);

    const [firstRepo] = repos;
    console.log(`\n── Querying: ${firstRepo.owner}/${firstRepo.name} ─────────────────`);

    const stats = await fetchRepoContributions(firstRepo, token);

    console.log(`\nContributors found: ${stats.size}`);
    console.log('\n── Raw ContributorStats map ─────────────────────────');
    console.log(
      JSON.stringify(
        Object.fromEntries(
          Array.from(stats.entries()).sort((a, b) => {
            const scoreA = a[1].commits + a[1].prs * 5 + a[1].reviews * 3 + a[1].issues * 2;
            const scoreB = b[1].commits + b[1].prs * 5 + b[1].reviews * 3 + b[1].issues * 2;
            return scoreB - scoreA;
          }),
        ),
        null,
        2,
      ),
    );

    for (const [, s] of stats) {
      expect(typeof s.commits).toBe('number');
      expect(typeof s.prs).toBe('number');
      expect(typeof s.reviews).toBe('number');
      expect(typeof s.issues).toBe('number');
      expect(s.repos).toContain(`${firstRepo.owner}/${firstRepo.name}`);
    }
  });

  it('runs the full scoring pipeline and validates formula', async () => {
    const scores = await getContributionScores(token, PROJECTS_URL);

    console.log('\n── Full ContributorScore results ────────────────────');
    console.log(JSON.stringify(scores, null, 2));

    console.log('\n── Leaderboard ──────────────────────────────────────');
    scores.forEach((s, i) => {
      console.log(
        `  ${String(i + 1).padStart(3)}. ${s.login.padEnd(20)} score=${String(s.score).padStart(5)}` +
          `  (c=${s.commits} p=${s.prs} r=${s.reviews} i=${s.issues})` +
          `  repos=[${s.repos.join(', ')}]`,
      );
    });
    console.log(`\nTotal contributors: ${scores.length}`);

    for (const s of scores) {
      const expected = s.commits * 1 + s.prs * 5 + s.reviews * 3 + s.issues * 2;
      expect(s.score).toBe(expected);
    }

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i].score).toBeLessThanOrEqual(scores[i - 1].score);
    }
  });
});
