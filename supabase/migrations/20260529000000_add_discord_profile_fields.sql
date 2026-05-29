ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS discord_display_name text,
  ADD COLUMN IF NOT EXISTS discord_avatar       text;
