-- Public member cards and the Discord username check are the last two reads that loaded
-- whole rows through the service role. Both now go through security definer functions:
-- one exact match, card columns only. API roles keep no table access; the API calls these
-- with the service role, so nothing new is exposed over PostgREST.

create or replace function public.verify_member(p_lookup text)
returns table (
  uid text,
  member_id text,
  full_name text,
  display_name text,
  show_full_name boolean,
  specialization text,
  secondary_specialization text,
  role text,
  status text,
  year_joined integer,
  discord_username text,
  is_admin boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    u.uid::text,
    u.member_id,
    u.full_name,
    u.display_name,
    coalesce(u.show_full_name, false),
    u.specialization,
    u.secondary_specialization,
    u.role,
    u.status,
    u.year_joined,
    u.discord_username,
    coalesce(u.is_admin, false)
  from public.users u
  where u.member_id = p_lookup or u.uid::text = p_lookup
  limit 1;
$$;

create or replace function public.discord_username_taken(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users u where lower(u.discord_username) = lower(p_username)
  );
$$;

revoke all on function public.verify_member(text) from public, anon, authenticated;
revoke all on function public.discord_username_taken(text) from public, anon, authenticated;
grant execute on function public.verify_member(text) to service_role;
grant execute on function public.discord_username_taken(text) to service_role;
