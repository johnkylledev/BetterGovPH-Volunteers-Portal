-- Opt-in: show my sign-in profile picture on public pages. Off unless the member turns it on,
-- because a face photo beside a redacted name would undo the redaction. The picture itself is
-- never stored; it is read live from the auth record (see provider_photos()).
alter table public.users add column if not exists show_photo boolean not null default false;
