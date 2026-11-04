-- Volunteer hours (confirmed by the team head or call poster), project updates, and when/where/how
-- members can help. Region is coarse (no address) and languages are not sensitive personal information.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS availability text[] NOT NULL DEFAULT '{}',   -- weekdays | weeknights | weekends
  ADD COLUMN IF NOT EXISTS hours_per_week text,                         -- 1-2 | 3-5 | 6-10 | 10+
  ADD COLUMN IF NOT EXISTS region text,                                 -- one of the 17 PH regions, or Abroad
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.volunteer_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id text,
  call_id uuid REFERENCES public.volunteer_calls(id) ON DELETE SET NULL,
  hours numeric(5,1) NOT NULL CHECK (hours > 0 AND hours <= 200),
  activity text NOT NULL,
  worked_on date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK (project_id IS NOT NULL OR call_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS volunteer_hours_user_idx ON public.volunteer_hours (user_id, status);
CREATE INDEX IF NOT EXISTS volunteer_hours_project_idx ON public.volunteer_hours (project_id, status);
CREATE INDEX IF NOT EXISTS volunteer_hours_call_idx ON public.volunteer_hours (call_id, status);
ALTER TABLE public.volunteer_hours ENABLE ROW LEVEL SECURITY;  -- API only
REVOKE ALL ON public.volunteer_hours FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_updates_project_idx ON public.project_updates (project_id, created_at DESC);
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;  -- API only
REVOKE ALL ON public.project_updates FROM anon, authenticated;

-- Deleting a call clears call_id (ON DELETE SET NULL); keep the entry valid and keep its name for certificates.
ALTER TABLE public.volunteer_hours DROP CONSTRAINT IF EXISTS volunteer_hours_check;
ALTER TABLE public.volunteer_hours ADD COLUMN IF NOT EXISTS context_label text;
