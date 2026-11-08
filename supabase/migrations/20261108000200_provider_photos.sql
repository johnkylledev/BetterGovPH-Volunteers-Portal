-- The sign-in provider's current profile picture, read live from auth.users for a set of members.
-- Nothing is copied into public.users, so when someone changes their picture at Google (or GitHub)
-- the next page load shows the new one. Returns the URL only, never any other auth data.
-- Security definer because auth.users is not readable by the API role directly; execute is granted
-- to service_role only, so this is reachable through our API and nowhere else.
create or replace function public.provider_photos(p_uids uuid[])
returns table (uid uuid, photo_url text)
language sql
security definer
set search_path = public
stable
as $$
  select u.id,
         coalesce(
           u.raw_user_meta_data ->> 'avatar_url',
           u.raw_user_meta_data ->> 'picture'
         )
  from auth.users u
  where u.id = any(p_uids)
    and coalesce(
          u.raw_user_meta_data ->> 'avatar_url',
          u.raw_user_meta_data ->> 'picture'
        ) like 'https://%';
$$;

revoke all on function public.provider_photos(uuid[]) from public, anon, authenticated;
grant execute on function public.provider_photos(uuid[]) to service_role;
