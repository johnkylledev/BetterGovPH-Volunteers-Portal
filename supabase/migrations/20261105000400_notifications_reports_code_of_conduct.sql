-- In-app notifications, code of conduct agreement, and reports on calls and projects.

-- Notifications: who raised a hand, join requests and decisions, project reviews, membership approval.
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,                -- in-app path, e.g. /projects/<id>
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;  -- API only
REVOKE ALL ON public.notifications FROM anon, authenticated;

-- When the member agreed to the code of conduct.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS coc_accepted_at timestamptz;

-- Reports from members. The reported person never learns who reported them.
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('call', 'project')),
  target_id text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'misleading', 'privacy', 'other')),
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  UNIQUE (reporter_id, target_type, target_id)  -- one report per person per item
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status, created_at DESC);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;  -- API only
REVOKE ALL ON public.reports FROM anon, authenticated;
