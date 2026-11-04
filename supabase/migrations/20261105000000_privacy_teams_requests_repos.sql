-- Privacy, roles, requests, teams and repo tracking.
-- Every statement is idempotent; the API keeps working (with these features off) until this runs.

-- ---------------------------------------------------------------------------
-- 1. Members: secondary role, public visibility, Data Privacy Act consent
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '{}'::jsonb,          -- from 20261104 (never applied)
  ADD COLUMN IF NOT EXISTS secondary_specialization text,
  ADD COLUMN IF NOT EXISTS show_in_directory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_full_name boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_purposes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Append-only consent history: the evidence half of the Record of Processing Activities (ROPA).
CREATE TABLE IF NOT EXISTS public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('granted', 'updated', 'withdrawn')),
  consent_version text NOT NULL,
  purposes jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_log_user_idx ON public.consent_log (user_id, created_at DESC);
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY; -- no policies: only the API (service role) can touch it

-- ---------------------------------------------------------------------------
-- 2. Requests board: a call can ask for things (venue, equipment, …), not just people
-- ---------------------------------------------------------------------------
ALTER TABLE public.volunteer_calls
  ADD COLUMN IF NOT EXISTS call_type text NOT NULL DEFAULT 'people',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS needed_by date;

-- ---------------------------------------------------------------------------
-- 3. Projects: owner, team head, repo tracking, review notes
-- ---------------------------------------------------------------------------
ALTER TABLE public.project_submissions
  ADD COLUMN IF NOT EXISTS repo_url text,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS owner_type text,      -- 'member' | 'org'
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS team_head_id uuid,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS repo_stats jsonb,
  ADD COLUMN IF NOT EXISTS repo_checked_at timestamptz;

-- Existing projects: the submitter leads the team.
UPDATE public.project_submissions SET team_head_id = NULLIF(user_id::text, '')::uuid WHERE team_head_id IS NULL AND user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Project teams: join requests, approvals, head role
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,                  -- text so it works whatever type project_submissions.id is
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('head', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'left')),
  message text,
  team_role text,                            -- what they do on the team, e.g. "Frontend", "Video editor"
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS team_members_project_idx ON public.team_members (project_id, status);
CREATE INDEX IF NOT EXISTS team_members_user_idx ON public.team_members (user_id);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY; -- API only

-- Seed heads for existing projects.
INSERT INTO public.team_members (project_id, user_id, role, status, decided_at)
SELECT id::text, NULLIF(user_id::text, '')::uuid, 'head', 'approved', now()
FROM public.project_submissions
WHERE NULLIF(user_id::text, '') IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Security: every write goes through the API (service role); public reads get public columns only
-- ---------------------------------------------------------------------------
-- The old policy let a signed-in member INSERT their own row with status 'approved', skipping review.
DROP POLICY IF EXISTS auth_project_submissions_self ON public.project_submissions;
DROP POLICY IF EXISTS auth_project_submissions_self_select ON public.project_submissions;
CREATE POLICY auth_project_submissions_self_select ON public.project_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.project_submissions FROM anon, authenticated;

-- Anonymous readers (approved projects only, via RLS) no longer see submitter ids, review notes or team data.
REVOKE SELECT ON public.project_submissions FROM anon;
GRANT SELECT (id, project_name, project_url, description, proj_type, status, created_at,
              repo_url, stage, owner_type, owner_name, repo_stats)
  ON public.project_submissions TO anon;

-- New tables are API-only.
REVOKE ALL ON public.team_members FROM anon, authenticated;
REVOKE ALL ON public.consent_log FROM anon, authenticated;
