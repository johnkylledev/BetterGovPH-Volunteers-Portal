-- Optional links a volunteer can add to their profile (YouTube, TikTok, GitHub, portfolio, …).
-- Keys: facebook, instagram, tiktok, youtube, x, linkedin, github, portfolio. Values are https URLs.
-- Private: shown only to the member and admins, never on the public card, /verify or /volunteers.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '{}'::jsonb;
