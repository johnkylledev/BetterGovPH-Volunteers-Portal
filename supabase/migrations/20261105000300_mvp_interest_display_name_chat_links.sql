-- MVP (meeting 2026-11-04): browse calls without logging in, say "I'm interested", use a pseudonym,
-- coordinate on Messenger/WhatsApp/Viber instead of only Discord, and import existing Discord projects.

-- Optional public name (username or pseudonym). The legal name stays private.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name text;

-- Group chat link (Messenger, WhatsApp, Viber, Telegram, Discord). Shown to signed-in members only.
ALTER TABLE public.volunteer_calls
  ADD COLUMN IF NOT EXISTS chat_url text;

ALTER TABLE public.project_submissions
  ADD COLUMN IF NOT EXISTS chat_url text,
  ADD COLUMN IF NOT EXISTS imported boolean NOT NULL DEFAULT false;   -- added by an admin from Discord

-- "I'm interested" on a call. The poster (and admins) see who raised a hand; nobody else does.
CREATE TABLE IF NOT EXISTS public.call_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.volunteer_calls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id, user_id)
);
CREATE INDEX IF NOT EXISTS call_interests_call_idx ON public.call_interests (call_id, status);
CREATE INDEX IF NOT EXISTS call_interests_user_idx ON public.call_interests (user_id);
ALTER TABLE public.call_interests ENABLE ROW LEVEL SECURITY;  -- API only
REVOKE ALL ON public.call_interests FROM anon, authenticated;

-- How the poster can reach an interested volunteer when they have no Discord (a Messenger link, a handle…).
ALTER TABLE public.call_interests ADD COLUMN IF NOT EXISTS contact text;
