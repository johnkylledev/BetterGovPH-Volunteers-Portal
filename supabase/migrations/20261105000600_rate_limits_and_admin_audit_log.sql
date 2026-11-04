-- Rate limiting that holds across every serverless instance (a per-instance memory counter doesn't),
-- and an append-only log of admin actions (Data Privacy Act accountability).

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket text PRIMARY KEY,          -- e.g. "ip:1.2.3.4:write" or "user:<uid>:report"
  hits integer NOT NULL,
  window_ends timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON public.rate_limits (window_ends);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;  -- API only
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- One atomic round trip: count the hit and say whether it is allowed (fixed window).
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_bucket text, p_limit integer, p_window_seconds integer)
RETURNS TABLE (ok boolean, rem integer, resets timestamptz)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hits integer;
  v_ends timestamptz;
BEGIN
  INSERT INTO public.rate_limits AS rl (bucket, hits, window_ends)
  VALUES (p_bucket, 1, now() + make_interval(secs => p_window_seconds))
  ON CONFLICT (bucket) DO UPDATE
    SET hits = CASE WHEN rl.window_ends <= now() THEN 1 ELSE rl.hits + 1 END,
        window_ends = CASE WHEN rl.window_ends <= now() THEN now() + make_interval(secs => p_window_seconds) ELSE rl.window_ends END
  RETURNING rl.hits, rl.window_ends INTO v_hits, v_ends;
  ok := v_hits <= p_limit;
  rem := greatest(p_limit - v_hits, 0);
  resets := v_ends;
  RETURN NEXT;
END
$$;
REVOKE EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,             -- member.status, project.review, member.erase, privacy.export, …
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;  -- API only
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
