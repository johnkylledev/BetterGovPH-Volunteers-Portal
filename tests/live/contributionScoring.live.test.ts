import { describe, it, expect } from 'vitest';
import { getContributionScores } from '../../api/_lib/scoring';
import type { ExternalProject } from '../../api/_lib/types';

const token = process.env.GITHUB_TOKEN ?? '';

describe.skipIf(!token)('contribution scoring — live', () => {
  const PROJECTS_URL = 'https://bettergov.ph/api/projects.json';

  it('runs the full scoring pipeline and validates formula', async () => {
    const scores = await getContributionScores(token, PROJECTS_URL);

    console.log('\n── Full ContributorScore results ────────────────────');
    console.log(JSON.stringify(scores.slice(0, 5), null, 2));

    console.log('\n── Leaderboard (top 10) ────────────────────────────');
    scores.slice(0, 10).forEach((s, i) => {
      console.log(
        `  ${String(i + 1).padStart(3)}. ${s.login.padEnd(20)} score=${String(s.score).padStart(5)}` +
          `  (c=${s.commits} p=${s.prs} r=${s.reviews} i=${s.issues})`,
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
