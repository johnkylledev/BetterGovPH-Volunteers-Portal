-- The admin member list no longer excludes admins (a super admin must be able to find their own
-- row), so the partial indexes that assumed is_admin = false can no longer serve it.
drop index if exists public.users_admin_list_idx;
drop index if exists public.users_status_created_idx;
drop index if exists public.users_specialization_idx;

create index if not exists users_admin_list_idx
  on public.users (created_at desc, uid desc);

create index if not exists users_status_created_idx
  on public.users (status, created_at desc, uid desc);

create index if not exists users_specialization_idx
  on public.users (specialization);
