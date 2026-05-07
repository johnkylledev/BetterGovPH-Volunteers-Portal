# BetterGovPH Access Card

A membership platform for [BetterGovPH](https://bettergov.ph/) — a civic tech community of Filipino volunteers building open-source tools for better governance. Members receive a digital access card with a QR code that links to a public verification page.

## Features

- **Member registration** — email/password or Google OAuth via Supabase Auth
- **Digital access card** — animated, downloadable card showing name, specialization, skills, and a QR code for public verification
- **Public verification** — `/verify/:memberId` lets anyone confirm a member's identity without logging in
- **Admin dashboard** — review applications, approve/decline members, manage project submissions and volunteer calls
- **Project showcase** — approved civic tech projects listed at `/projects`
- **Volunteer call board** — members can post and browse collaboration requests

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| Animation | Framer Motion, GSAP |
| State | Zustand |
| Auth & DB | Supabase (PostgreSQL + Auth) |
| API | Vercel Serverless Functions |
| Deployment | Vercel |

## Local Development

### Prerequisites

- Node.js ≥ 18
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- A Supabase project

### Environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Running

```bash
npm install

# Frontend only (API calls will fail — use for UI-only work)
npm run dev          # http://localhost:3000

# Full-stack (Vercel Functions + Vite proxy)
npm run dev:full     # vercel dev on :3001; open http://localhost:3000
```

`dev:full` runs `vercel dev` on port 3001 and Vite's dev server on port 3000. Vite proxies all `/api/*` requests to 3001, so you need both processes running simultaneously (open two terminals, or use a process manager).

## Deployment

The project deploys to Vercel. `vercel.json` routes `/api/*` to serverless functions and everything else to `index.html` for client-side routing. Set all environment variables (including `SUPABASE_SERVICE_ROLE_KEY`) in the Vercel project settings.

## Database Schema (Supabase)

Key tables:

- **`users`** — member profiles (`uid`, `full_name`, `email`, `specialization`, `role`, `discord_username`, `status`, `member_id`, `is_admin`, `skills` jsonb, etc.)
- **`project_submissions`** — civic project submissions (`project_name`, `project_url`, `description`, `proj_type`, `status`, `user_id`)
- **`volunteer_calls`** — volunteer collaboration posts

Member IDs follow the format `BGPH-{year}-{3 digits}` and are generated server-side on approval.

## Project Structure

```
api/                    Vercel serverless functions
  admin/                Admin-only endpoints
src/
  components/           Shared UI (AccessCard, LoadingOverlay, etc.)
  constants/            Skills and specialization dropdown values
  hooks/                Custom hooks
  pages/
    admin/              AdminDashboard
    auth/               Login, Register
    dashboard/          UserDashboard
    public/             Landing, Verify, Projects, Privacy, Terms
  services/supabase.ts  All API calls and Supabase client
  store/useStore.ts     Zustand global store
  types/index.ts        Shared TypeScript types
```
