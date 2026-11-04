-- Calls: how much time, where, and whether it suits a newcomer (ideas from Idealist, DemocracyLab and
-- GitHub's "good first issue" research). Members: a self-service erasure request (RA 10173, right to erasure).
ALTER TABLE public.volunteer_calls
  ADD COLUMN IF NOT EXISTS commitment text,          -- one-off | few-hours | weekly | ongoing
  ADD COLUMN IF NOT EXISTS work_mode text,           -- remote | onsite | hybrid
  ADD COLUMN IF NOT EXISTS good_first boolean NOT NULL DEFAULT false;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
