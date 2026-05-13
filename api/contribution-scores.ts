import { getContributionScores } from './_lib/contributionScoring';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.GITHUB_TOKEN ?? '';
  if (!token) {
    res.status(500).json({ error: 'Server not configured', missing: ['GITHUB_TOKEN'] });
    return;
  }

  try {
    const scores = await getContributionScores(token);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json({ scores, generatedAt: new Date().toISOString() });
  } catch (err) {
    const message = typeof (err as any)?.message === 'string' ? String((err as any).message) : '';
    res.status(500).json({ error: 'Failed to compute scores', details: message || undefined });
  }
}
