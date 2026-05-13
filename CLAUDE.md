# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend only (no API routes)
npm run dev          # Vite dev server on :3000

# Full-stack local dev (proxies /api to Vercel Functions on :3001)
npm run dev:full     # vercel dev on :3001; vite proxies /api to it

# Type-check without emitting
npm run check

# Build & lint
npm run build
npm run lint
```

> **Important:** `npm run dev` alone has no backend — `/api/*` calls will 404. Use `dev:full` when working on features that touch API routes. The two servers must both be running; vite (`dev`) proxies `/api` to `:3001`.

## Architecture

### Layers

```
src/           React SPA (Vite + TypeScript)
api/           Vercel Serverless Functions (Node, TypeScript)
```

The frontend never talks to Supabase directly for protected data — it calls `/api/*` endpoints with a Supabase JWT (`Authorization: Bearer <token>`). Each API handler validates the token using the **service role key** before touching the database.

### Auth flow

1. `App.tsx` bootstraps on mount: calls `supabase.auth.getSession()`, sets `sessionUserId` + `authInitialized` in the Zustand store, then fetches the user profile via `GET /api/me`.
2. `supabase.auth.onAuthStateChange` keeps the session in sync at runtime.
3. A Supabase Realtime channel on the `users` table keeps `currentUser` live after admin status changes.
4. `ProtectedRoute` / `PublicRoute` in `App.tsx` gate routes based on `authInitialized`, `sessionUserId`, `currentUser`, `isAdmin`, and profile completeness.

### State management

Single Zustand store at `src/store/useStore.ts`. Holds `currentUser`, `sessionUserId`, `authInitialized`, and the user list used by the admin panel. Most mutations go through the store actions which delegate to `src/services/supabase.ts`.

### API / data layer (`src/services/supabase.ts`)

All frontend↔backend communication flows through `apiRequest()` — a thin `fetch` wrapper with a 30 s timeout and structured error extraction. Functions like `getUserData`, `getAllUsers`, `updateUserStatus` call `/api/*` endpoints. The frontend Supabase client is used only for auth operations (signIn, signUp, OAuth, signOut) and the fallback `getApprovedProjects` query.

### DB column mapping

Supabase uses `snake_case` columns; the app uses `camelCase`. `mapUserRow` (in each API handler) and `mapToAppUser` / `mapToDbUser` (in `supabase.ts`) handle the conversion. Always go through these mappers — don't construct raw DB objects in component code.

### Serverless API routes (`api/`)

| Route | Purpose |
|---|---|
| `GET/POST /api/me` | Read or upsert current user's profile |
| `GET /api/admin/users` | Paginated user list (admin) |
| `GET /api/admin/stats` | Member counts (admin) |
| `POST /api/admin/update-user-status` | Approve/decline a member |
| `GET/POST /api/admin/project-submissions` | Admin project review |
| `GET/POST /api/my-project-submissions` | User's own submissions |
| `POST /api/submit-project` | Submit a civic project |
| `GET/DELETE /api/volunteer-calls` | Volunteer call board |
| `GET /api/verify[/:id]` | Public member verification |
| `GET /api/discord-username-taken` | Duplicate Discord check |
| `GET /api/projects` | Public approved projects list |

Every admin endpoint re-checks `is_admin` from the DB on every request.

### Routing (`src/App.tsx`)

| Path | Component | Guard |
|---|---|---|
| `/` | Landing | public |
| `/login` | Login | PublicRoute (redirects logged-in users) |
| `/register` | Register | none (needed for Google OAuth completion) |
| `/dashboard` | UserDashboard | ProtectedRoute |
| `/admin` | AdminDashboard | ProtectedRoute (adminOnly) |
| `/verify[/:id]` | Verify | public |
| `/projects` | Projects | public |

### Key constants / types

- `src/types/index.ts` — all shared types (`User`, `ProjectSubmission`, `VolunteerCall`, `ApplicationStatus`, `SkillLevel`, etc.)
- `src/constants/skills.ts` & `specializations.ts` — dropdown values
- Member ID format: `BGPH-{year}-{3 random digits}` (generated server-side in `update-user-status.ts`)

### Environment variables

Frontend (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

API handlers (Vercel env / `.env`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (each handler also accepts `VITE_` and `NEXT_PUBLIC_` prefixes as fallbacks)

### Path alias

`@/*` resolves to `./src/*` (configured in both `tsconfig.json` and vite via `vite-tsconfig-paths`).
