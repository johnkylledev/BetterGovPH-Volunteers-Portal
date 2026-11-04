# Plan: GitHub account linking (OAuth) + centralized contribution scoring

> Status: **proposed, not implemented.**
> Admin-side setup (GitHub OAuth App + Supabase dashboard) lives in [supabase-github-setup.md](./supabase-github-setup.md).

## Context

The portal can link Discord, but GitHub is a "Coming soon" placeholder (`src/pages/auth/Register.tsx` ~884-898, `src/pages/dashboard/Profile.tsx` Connections tab ~354-370).

`GET /api/contribution-scores` exists, but nothing in `src/` consumes it, and scores are keyed by GitHub login with no link to portal users.

The scoring code is duplicated:

- `api/_lib/contributionScoring.ts` is exported and tested, but unused at runtime.
- An identical inline copy in `api/[...path].ts` (~233-444) is what actually runs. It was inlined in commit `c73c152` to work around a Vercel problem. The `"type": "module"` extensionless-import theory (see `342d344`) is likely the real cause, but it is unverified.

**Goal:** members link GitHub with a click (OAuth, no personal access tokens for users), there is one scoring module, and linked members are tied to their score.

## Decisions

- **Mechanism: Supabase `linkIdentity({ provider: 'github' })`.** Supabase runs the OAuth handshake (state/CSRF, code exchange). The server then reads the verified GitHub identity from `supabase.auth.admin.getUserById(uid)`. No HMAC, no callback page, no token storage. This is much less code than mirroring the bettygo/Discord flow.
- **Linking is optional.** `isProfileComplete` (`src/App.tsx`) and Register's submit gating stay Discord-only.
- **Scope:** `read:user` (the default). No repo scope, no PAT for users.
- **Out of scope** (separate follow-up, so Part 1 stays a pure refactor): bot filtering, PR/issue pagination, GraphQL `errors` checking, login lowercasing.
- **`GITHUB_TOKEN` stays** for server-side scoring queries only. It could later be swapped for a GitHub App installation token.

## Part 1: Centralize scoring (do first, own commit)

1. In `api/[...path].ts`, delete the inline copy (~lines 233-444). Import `getContributionScores` from `./_lib/contributionScoring.js` (explicit `.js` extension).
2. Switch the two test imports to the same `.js` specifier:
   - `tests/unit/contributionScoring.test.ts`
   - `tests/live/contributionScoring.live.test.ts`
3. **Verify on a Vercel preview deploy** before relying on it. Fallback if the import still fails: move the module to `lib/contributionScoring.ts` and add `functions["api/[...path].ts"].includeFiles: "lib/**"` to `vercel.json`.
4. Keep `handler_contribution_scores` unchanged, but cache `getContributionScores` in Redis using the existing `getCache`/`setCache` helpers (~154-215 in `api/[...path].ts`). Key `cache:contribution-scores`, TTL 1h. The function's 10s `maxDuration` is tight for an uncached GitHub fan-out.

## Part 2: GitHub linking

### Prerequisites

Manual, done by a Supabase/GitHub admin. See [supabase-github-setup.md](./supabase-github-setup.md).

### Database

New migration `supabase/migrations/<timestamp>_add_github_fields.sql`:

- Columns: `github_id text`, `github_username text`, `github_avatar text`, `github_connected boolean not null default false`.
- Partial unique indexes on `github_id` and on `lower(github_username)`, both `where ... is not null`. Discord has no DB-level constraint, so this closes the select-then-write race for GitHub.
- Check production RLS on `users` first. It is not in the repo.

### Backend (`api/[...path].ts`)

Add `handler_github`. Register it in all three places: the `HandlerKey` union, the `HANDLERS` map, and the dispatch `if` chain (~1626-1691). Auth follows the existing `getBearerToken` + `supabase.auth.getUser` pattern.

| Method | Behavior |
|---|---|
| `GET /api/github` | Return the user's stored github fields. |
| `POST /api/github` (sync) | `admin.getUserById(uid)`, find the identity with `provider === 'github'`, persist `provider_id`, `identity_data.user_name`, `avatar_url`. `409` if another user already holds that `github_id`. `400` if no GitHub identity exists. Check the updated row count so a missing user row is not a silent no-op. |
| `DELETE /api/github` | Clear the columns. The client calls `unlinkIdentity` first. Safe because every user has a Google identity. |

Also extend `mapUserRow` (~129-152) with the `github*` fields.

If Part 1 proves `_lib` imports work, put the identity-extraction logic in `api/_lib/github.ts` as a pure function so it can be unit tested.

### Frontend

- `src/types/index.ts`: add `githubId?`, `githubUsername?`, `githubAvatar?`, `githubConnected?` to `User` (~55-80).
- `src/services/supabase.ts`: add `connectGitHub()` (`linkIdentity`, `redirectTo` is the current page with `?github=linked`, return path in `sessionStorage` like `discord_return_to`), `syncGitHub()`, `disconnectGitHub()`, `getGitHubStatus()`. Update `mapToAppUser` / `mapToDbUser`.
- `src/store/useStore.ts`: `updateCurrentUserFromSupabase` (~86-110) hand-builds a `User` and drops the discord fields. Add the github fields, or confirm the function is dead.
- `Register.tsx`: replace the "Coming soon" card with a working optional Connect card. On return with `?github=linked`, call `syncGitHub`. Surface `identity_already_exists` errors.
- `Profile.tsx` Connections tab: replace the disabled "Soon" row with Connect/Disconnect, showing `@login` and the avatar.
- `UserDashboard.tsx`: show the linked GitHub account beside Discord (~836-848).
- `vercel.json` CSP: add `https://avatars.githubusercontent.com` to `img-src`.

## Part 3: Show scores

Profile's GitHub row fetches `/api/contribution-scores` lazily, matches the user's `githubUsername` case-insensitively, and shows score plus commits / PRs / reviews / issues. If the user is not in the scores, show "No contributions yet". Do not block page load on it.

## Critical files

`api/[...path].ts`, `api/_lib/contributionScoring.ts`, `src/services/supabase.ts`, `src/types/index.ts`, `src/store/useStore.ts`, `src/pages/auth/Register.tsx`, `src/pages/dashboard/Profile.tsx`, `src/pages/dashboard/UserDashboard.tsx`, `vercel.json`, `supabase/config.toml`, `supabase/migrations/`, `README.md`.

## Verification

- `npm run check`, `npm run lint`, `npm test`. The existing 18 scoring tests must pass unchanged after the move. Add unit tests for the identity-extraction helper.
- `GITHUB_TOKEN=$(gh auth token) npm run test:live` confirms scoring still works after centralization.
- On a preview deploy, `/api/contribution-scores` returns 200 with a valid JWT. This proves the centralized import works on Vercel.
- End to end with `npm run dev:full` against a Supabase project with GitHub configured:
  1. A Google-signed-in user clicks Connect GitHub, authorizes, and returns with the login and avatar shown.
  2. Disconnect clears it.
  3. A second account trying the same GitHub user gets a clear `409` / `identity_already_exists` message.
  4. A user who never links GitHub still reaches the dashboard.
  5. Realtime refresh updates the UI without a reload.
- Confirm avatars render under the new CSP.

## Documentation to update when implemented

The README's Discord flow description is stale (it mentions `/auth/callback` and `api/_handlers/*`, which no longer exist). Fix it while documenting GitHub dev setup.
