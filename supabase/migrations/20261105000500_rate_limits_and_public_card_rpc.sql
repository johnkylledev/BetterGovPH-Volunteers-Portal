-- 1) Rate limiting for the public API -------------------------------------
-- PostgREST/Supabase do not throttle anything except the auth endpoints, and the
-- serverless handlers are stateless, so counters live in a table and every check
-- is a single atomic upsert via security definer.
create table if not exists public.rate_limits (
  bucket text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.rate_limit_hit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
) returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.rate_limits;
begin
  insert into public.rate_limits as rl (bucket, window_start, hits)
  values (p_bucket, v_now, 1)
  on conflict (bucket) do update set
    window_start = case
      when rl.window_start + make_interval(secs => p_window_seconds) <= v_now then v_now
      else rl.window_start
    end,
    hits = case
      when rl.window_start + make_interval(secs => p_window_seconds) <= v_now then 1
      else rl.hits + 1
    end
  returning * into v_row;

  -- Opportunistic cleanup so the table never grows without bound.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < v_now - interval '1 day';
  end if;

  allowed := v_row.hits <= p_limit;
  remaining := greatest(p_limit - v_row.hits, 0);
  retry_after := greatest(
    ceil(extract(epoch from (v_row.window_start + make_interval(secs => p_window_seconds) - v_now)))::integer,
    1
  );
  return next;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public;
revoke all on function public.rate_limit_hit(text, integer, integer) from anon, authenticated;

-- 2) Public member cards ---------------------------------------------------
-- /verify used to read the whole users row with the service role key. The card is
-- now served by a security definer function that can only return the public
-- columns of one exact member ID or uid, so the API never needs the service role
-- for public traffic.
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

revoke all on function public.verify_member(text) from public;
grant execute on function public.verify_member(text) to anon, authenticated;

-- 3) Discord username availability ---------------------------------------
-- Same oracle as before (the sign-up form needs it) but without handing the
-- select on public.users to the anon key.
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

revoke all on function public.discord_username_taken(text) from public;
grant execute on function public.discord_username_taken(text) to anon, authenticated;

-- 4) Close the anon read path --------------------------------------------
-- The anon key ships in the browser bundle. With RLS off, anyone could read the
-- whole users table straight from PostgREST; the API reaches the table with the
-- service role (bypasses RLS) or the two functions above.
alter table public.users enable row level security;

drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select to authenticated
  using (uid::text = auth.uid()::text);

revoke select on public.users from anon;
grant select (uid, member_id, full_name, display_name, show_full_name, specialization,
  secondary_specialization, role, status, year_joined, is_admin)
  on public.users to authenticated;
