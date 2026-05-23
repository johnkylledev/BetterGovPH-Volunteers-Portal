ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS discord_id        text,
  ADD COLUMN IF NOT EXISTS discord_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discord_verified  boolean NOT NULL DEFAULT false;
