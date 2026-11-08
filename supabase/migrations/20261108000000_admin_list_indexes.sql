-- Indexes for the admin member list: keyset paging, tab filters, role filter, delta sync and search.
create extension if not exists pg_trgm;

-- Main listing: members only, newest first. (created_at, uid) is the keyset order, so paging stays
-- stable when rows are inserted while an admin is paging.
create index if not exists users_admin_list_idx
  on public.users (created_at desc, uid desc)
  where is_admin = false;

-- Applications / Members tabs filter by status on top of that order.
create index if not exists users_status_created_idx
  on public.users (status, created_at desc, uid desc)
  where is_admin = false;

-- Role filter.
create index if not exists users_specialization_idx
  on public.users (specialization)
  where is_admin = false;

-- Delta sync watermark: "everything changed since X".
create index if not exists users_updated_at_idx
  on public.users (updated_at desc);

-- Search is ILIKE '%term%', which no btree index can serve; trigram GIN does.
create index if not exists users_search_trgm_idx
  on public.users using gin (
    (coalesce(full_name, '') || ' ' || coalesce(email, '') || ' ' ||
     coalesce(discord_username, '') || ' ' || coalesce(member_id, '')) gin_trgm_ops
  );
