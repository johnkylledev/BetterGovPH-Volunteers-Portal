-- Role-based admin access.
--
-- Super admins stay users.is_admin = true and can do everything, including managing roles.
-- Everyone else can be given one custom role (users.admin_role_id) holding a set of permissions.
-- The API checks the caller's permissions on every request; anything not granted is refused,
-- and responses only carry data the caller's permissions cover.
--
-- Like every other table, admin_roles is reachable only through the API (service role):
-- RLS on, no grants to anon/authenticated, nothing in the realtime publication.

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  permissions text[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_roles_name_len check (char_length(btrim(name)) between 2 and 40),
  constraint admin_roles_description_len check (char_length(description) <= 200),
  -- Only known permissions; 'roles.manage' is deliberately absent: managing roles is super-admin only.
  constraint admin_roles_known_permissions check (
    permissions <@ array[
      'members.view', 'members.decide', 'projects.review', 'projects.import',
      'calls.moderate', 'reports.handle', 'privacy.records', 'privacy.erase', 'audit.view'
    ]::text[]
  )
);

create unique index if not exists admin_roles_name_unique on public.admin_roles (lower(btrim(name)));

alter table public.admin_roles enable row level security;
revoke all on table public.admin_roles from anon, authenticated, public;

alter table public.users
  add column if not exists admin_role_id uuid references public.admin_roles (id) on delete set null;

create index if not exists users_admin_role_id_idx on public.users (admin_role_id) where admin_role_id is not null;
