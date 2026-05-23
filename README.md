# BetterGovPH Access Card

A membership platform for [BetterGovPH](https://bettergov.ph/) — a civic tech community of Filipino volunteers building open-source tools for better governance. Members receive a digital access card with a QR code that links to a public verification page.

## Features

- **Member registration** — email/password or Google OAuth via Supabase Auth, with a 4-step onboarding flow (Account → Profile → Skills → Connections)
- **Discord integration** — members link their Discord account via OAuth during onboarding; guild membership in the BetterGovPH server is verified automatically
- **Digital access card** — animated, downloadable card showing name, specialization, skills, and a QR code for public verification
- **Public verification** — `/verify/:memberId` lets anyone confirm a member's identity without logging in
- **Admin dashboard** — review applications, approve/decline members, manage project submissions and volunteer calls
- **Project showcase** — approved civic tech projects listed at `/projects`
- **Volunteer call board** — members can post and browse collaboration requests
- **Contribution scoring** — ranks contributors across all BetterGovPH GitHub repos by commits, pull requests, reviews, and issues

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| Animation | Framer Motion, GSAP |
| State | Zustand |
| Auth & DB | Supabase (PostgreSQL + Auth) |
| API | Vercel Serverless Functions |
| Discord OAuth | [bettygo](https://github.com/zelkim/bettygo) Cloudflare Worker |
| Deployment | Vercel |

## Local Development

### Prerequisites

- Node.js ≥ 18
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- A Supabase project
- A running [bettygo](https://github.com/zelkim/bettygo) instance for Discord OAuth (use `wrangler dev` locally)

### Environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Required for the contribution scoring endpoint and live tests
GITHUB_TOKEN=<github-pat>

# Discord OAuth — via bettygo (https://github.com/zelkim/bettygo)
# API_SECRET configured on the bettygo worker
BETTYGO_API_KEY=<bettygo-api-secret>
# Base URL of the bettygo worker (defaults to https://bg.zel.kim in production)
BETTYGO_BASE_URL=http://localhost:8787
# Must match an entry in bettygo's WEBAPP_REDIRECT_URI allowlist
DISCORD_CALLBACK_URL=http://localhost:3000/discord-callback
```

`GITHUB_TOKEN` should be a GitHub Personal Access Token (classic or fine-grained) with at minimum **read access to public repositories** (`public_repo` scope for classic PATs). It is only used server-side and is never sent to the browser.

### Running

```bash
npm install

# Frontend only (API calls will fail — use for UI-only work)
npm run dev          # http://localhost:3000

# Full-stack (Vercel Functions + Vite proxy)
npm run dev:full     # vercel dev + vite, open http://localhost:3000
```

`dev:full` runs `vercel dev` and Vite's dev server together. Vite proxies all `/api/*` requests to the Vercel dev server, so both processes must be running.

For Discord OAuth to work locally you also need bettygo running:

```bash
cd ../bettygo
wrangler dev          # starts on http://localhost:8787 by default
```

Then set `BETTYGO_BASE_URL=http://localhost:8787` and `DISCORD_CALLBACK_URL=http://localhost:3000/discord-callback` in your `.env`, and ensure those values are in bettygo's `WEBAPP_REDIRECT_URI` and `ALLOWED_ORIGIN` vars in its `wrangler.jsonc`.

## Contribution Scoring

`GET /api/contribution-scores` scores every contributor across all BetterGovPH civic projects by their GitHub activity.

### How it works

1. Fetches the live project list from `https://bettergov.ph/api/projects.json`
2. Extracts all `repositoryUrls` from every project (deduplicating across projects)
3. Queries the GitHub GraphQL API for each repo — commits, pull requests, PR reviews, and issues — with full cursor-based pagination
4. Aggregates activity per contributor login across all repos
5. Applies the scoring formula and returns results sorted highest first

### Scoring formula

```
score = commits × 1 + pull_requests × 5 + reviews × 3 + issues × 2
```

| Activity | Points |
|---|---|
| Commit on default branch | 1 |
| Pull request opened | 5 |
| PR review submitted | 3 |
| Issue opened | 2 |

### API response

```
GET /api/contribution-scores
```

```json
{
  "scores": [
    {
      "login": "zelkim",
      "score": 42,
      "commits": 12,
      "prs": 3,
      "reviews": 2,
      "issues": 4,
      "repos": ["bettergovph/bettergov", "bettergovph/open-data-portal"]
    }
  ],
  "generatedAt": "2026-05-13T07:04:42.000Z"
}
```

Results are cached for 1 hour (`Cache-Control: public, max-age=3600`) because the GitHub GraphQL queries are expensive for large repo histories.

### Core module

The logic lives in [api/_lib/contributionScoring.ts](api/_lib/contributionScoring.ts), independent of Supabase. It exports individual functions that can be used directly or composed:

| Function | Description |
|---|---|
| `fetchProjects(url)` | Fetches and parses the BetterGovPH projects list |
| `extractRepos(projects)` | Flattens and deduplicates GitHub repo URLs |
| `fetchRepoContributions(repo, token)` | Paginated GraphQL queries for one repo |
| `aggregateContributions(entries)` | Merges per-repo stats into a global contributor map |
| `scoreContributors(agg)` | Applies formula, returns sorted array |
| `getContributionScores(token, url?)` | Orchestrates the full pipeline |

### Tests

```bash
# Unit tests — mocked fetch, no network, no token required
npm run test

# Live tests — real GitHub API and bettergov.ph
npm run test:live
```

Live tests are automatically skipped when `GITHUB_TOKEN` is absent. They log the full raw output — extracted repos, contributor stats, and the complete leaderboard — to stdout.

## Deployment

The project deploys to Vercel. `vercel.json` routes `/api/*` to serverless functions and everything else to `index.html` for client-side routing. Set all environment variables in the Vercel project settings — including `SUPABASE_SERVICE_ROLE_KEY` and the three `BETTYGO_*` / `DISCORD_CALLBACK_URL` vars.

For production, omit `BETTYGO_BASE_URL` (it defaults to `https://bg.zel.kim`). Make sure the production `/discord-callback` URL is added to bettygo's `WEBAPP_REDIRECT_URI` and `ALLOWED_ORIGIN` in `wrangler.jsonc`, then redeploy bettygo.

## Database Schema (Supabase)

Key tables:

- **`users`** — member profiles (`uid`, `full_name`, `email`, `specialization`, `role`, `discord_username`, `discord_id`, `discord_connected`, `discord_verified`, `status`, `member_id`, `is_admin`, `skills` jsonb, etc.)
- **`project_submissions`** — civic project submissions (`project_name`, `project_url`, `description`, `proj_type`, `status`, `user_id`)
- **`volunteer_calls`** — volunteer collaboration posts

Member IDs follow the format `BGPH-{year}-{3 digits}` and are generated server-side on approval.

## Project Structure

```
api/
  _lib/
    contributionScoring.ts  Contribution scoring core logic (not a route)
  admin/                    Admin-only endpoints
  discord/
    login.ts                GET  /api/discord/login   — returns bettygo OAuth URL
    status.ts               GET  /api/discord/status  — reads Discord connection (no DB write)
    sync.ts                 POST /api/discord/sync    — persists Discord connection to Supabase
  contribution-scores.ts    GET /api/contribution-scores
  ...                       Other Vercel serverless functions
src/
  components/               Shared UI (AccessCard, LoadingOverlay, etc.)
  constants/                Skills and specialization dropdown values
  hooks/                    Custom hooks
  pages/
    admin/                  AdminDashboard
    auth/                   Login, Register (4-step onboarding), DiscordCallback
    dashboard/              UserDashboard
    public/                 Landing, Verify, Projects, Privacy, Terms
  services/supabase.ts      All API calls and Supabase client
  store/useStore.ts         Zustand global store
  types/index.ts            Shared TypeScript types
supabase/
  migrations/               SQL migration files applied in order
tests/
  unit/                     Unit tests (mocked, no network)
  live/                     Live integration tests (requires GITHUB_TOKEN)
```
