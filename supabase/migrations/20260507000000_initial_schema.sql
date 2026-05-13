create table public.project_submissions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  project_name text not null,
  project_url text not null,
  description text not null,
  proj_type text null,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  constraint project_submissions_pkey primary key (id),
  constraint project_submissions_user_id_fkey foreign key (user_id) references auth.users (id),
  constraint project_submissions_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'approved'::text,
          'rejected'::text
        ]
      )
    )
  )
) tablespace pg_default;

create index if not exists project_submissions_user_id_idx on public.project_submissions using btree (user_id) tablespace pg_default;

create index if not exists project_submissions_status_created_at_idx on public.project_submissions using btree (status, created_at desc) tablespace pg_default;


create table public.users (
  uid uuid not null,
  email text not null,
  full_name text null,
  specialization text null,
  role text null default 'Member'::text,
  discord_username text null,
  status text null default 'Pending'::text,
  member_id text null,
  admin_notes text null,
  is_admin boolean null default false,
  auth_provider text null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  year_joined integer null,
  skills jsonb null default '[]'::jsonb,
  experience_level text null,
  constraint users_pkey primary key (uid),
  constraint users_email_key unique (email),
  constraint users_member_id_key unique (member_id)
) tablespace pg_default;

create index if not exists idx_users_uid on public.users using btree (uid) tablespace pg_default;

create index if not exists idx_users_email on public.users using btree (email) tablespace pg_default;

create index if not exists idx_users_member_id on public.users using btree (member_id) tablespace pg_default;

create index if not exists idx_users_is_admin on public.users using btree (is_admin) tablespace pg_default;

create index if not exists idx_users_status on public.users using btree (status) tablespace pg_default;

create index if not exists idx_users_created_at on public.users using btree (created_at desc) tablespace pg_default;

create index if not exists idx_users_admin_status_date on public.users using btree (is_admin, status, created_at desc) tablespace pg_default;


create table public.volunteer_calls (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  title text not null,
  project_url text not null,
  description text not null,
  roles_needed text null,
  contact text null,
  status text not null default 'open'::text,
  created_at timestamp with time zone not null default now(),
  constraint volunteer_calls_pkey primary key (id),
  constraint volunteer_calls_user_id_fkey foreign key (user_id) references auth.users (id),
  constraint volunteer_calls_status_check check (
    (
      status = any (array['open'::text, 'closed'::text])
    )
  )
) tablespace pg_default;

create index if not exists volunteer_calls_status_created_at_idx on public.volunteer_calls using btree (status, created_at desc) tablespace pg_default;

create index if not exists volunteer_calls_user_id_idx on public.volunteer_calls using btree (user_id) tablespace pg_default;
