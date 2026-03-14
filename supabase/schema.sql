-- VolOps (Supabase-only) bootstrap schema + minimal RLS policies
-- Run this in Supabase SQL Editor.
--
-- Notes:
-- - This is a minimal schema that matches current frontend usage in:
--   - public/volunteer.js, public/organization.js, public/sitemanager.js
-- - It assumes you use Supabase Auth and each portal user owns exactly one profile row.

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.volunteers (
  id uuid primary key references auth.users(id) on delete cascade,
  vol_id text not null unique,
  name text not null,
  email text not null unique,
  age int,
  gender text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  location text not null,
  contact_email text not null unique,
  company_id text not null unique,
  org_code text not null unique,
  identity_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_managers (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text not null,
  unique_manager_id text not null unique,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Operations
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.drives (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  manager_id uuid references public.site_managers(id) on delete set null,
  token uuid not null unique default gen_random_uuid(),
  drive_code text not null unique,
  location text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  drive_id uuid not null references public.drives(id) on delete cascade,
  time_in timestamptz not null default now(),
  time_out timestamptz,
  hours_devoted numeric(6,2),
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_lat double precision,
  check_out_lng double precision,
  photo_url text,
  created_at timestamptz not null default now()
);

-- Helpful indexes for current queries
create index if not exists sessions_drive_id_idx on public.sessions(drive_id);
create index if not exists sessions_volunteer_id_idx on public.sessions(volunteer_id);
create index if not exists drives_org_id_idx on public.drives(org_id);
create index if not exists site_managers_org_id_idx on public.site_managers(org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists volunteers_set_updated_at on public.volunteers;
create trigger volunteers_set_updated_at
before update on public.volunteers
for each row execute function public.set_updated_at();

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.volunteers enable row level security;
alter table public.organizations enable row level security;
alter table public.site_managers enable row level security;
alter table public.drives enable row level security;
alter table public.sessions enable row level security;

-- Volunteers: user can manage only their own row
drop policy if exists volunteers_select_own on public.volunteers;
create policy volunteers_select_own on public.volunteers
for select to authenticated
using (id = auth.uid());

drop policy if exists volunteers_insert_own on public.volunteers;
create policy volunteers_insert_own on public.volunteers
for insert to authenticated
with check (id = auth.uid());

drop policy if exists volunteers_update_own on public.volunteers;
create policy volunteers_update_own on public.volunteers
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Organizations: user can manage only their own org row
drop policy if exists organizations_select_own on public.organizations;
create policy organizations_select_own on public.organizations
for select to authenticated
using (id = auth.uid());

drop policy if exists organizations_insert_own on public.organizations;
create policy organizations_insert_own on public.organizations
for insert to authenticated
with check (id = auth.uid());

drop policy if exists organizations_update_own on public.organizations;
create policy organizations_update_own on public.organizations
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Site managers: manager can select their own row; org owner can list managers under their org
drop policy if exists site_managers_select_own on public.site_managers;
create policy site_managers_select_own on public.site_managers
for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.organizations o
    where o.id = auth.uid() and o.id = site_managers.org_id
  )
);

drop policy if exists site_managers_insert_self on public.site_managers;
create policy site_managers_insert_self on public.site_managers
for insert to authenticated
with check (id = auth.uid());

drop policy if exists site_managers_update_own on public.site_managers;
create policy site_managers_update_own on public.site_managers
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Drives: site manager can manage drives under their org; org owner can read drives under their org
drop policy if exists drives_select_org_scope on public.drives;
create policy drives_select_org_scope on public.drives
for select to authenticated
using (
  exists (
    select 1 from public.site_managers m
    where m.id = auth.uid() and m.org_id = drives.org_id
  )
  or exists (
    select 1 from public.organizations o
    where o.id = auth.uid() and o.id = drives.org_id
  )
);

drop policy if exists drives_insert_manager_scope on public.drives;
create policy drives_insert_manager_scope on public.drives
for insert to authenticated
with check (
  exists (
    select 1 from public.site_managers m
    where m.id = auth.uid() and m.org_id = drives.org_id and m.id = drives.manager_id
  )
);

drop policy if exists drives_update_manager_scope on public.drives;
create policy drives_update_manager_scope on public.drives
for update to authenticated
using (
  exists (
    select 1 from public.site_managers m
    where m.id = auth.uid() and m.org_id = drives.org_id and m.id = drives.manager_id
  )
)
with check (
  exists (
    select 1 from public.site_managers m
    where m.id = auth.uid() and m.org_id = drives.org_id and m.id = drives.manager_id
  )
);

drop policy if exists drives_delete_manager_scope on public.drives;
create policy drives_delete_manager_scope on public.drives
for delete to authenticated
using (
  exists (
    select 1 from public.site_managers m
    where m.id = auth.uid() and m.org_id = drives.org_id and m.id = drives.manager_id
  )
);

-- Sessions: volunteer can insert/update/select their own; org owner can read sessions for drives under their org
drop policy if exists sessions_select_own_or_org on public.sessions;
create policy sessions_select_own_or_org on public.sessions
for select to authenticated
using (
  exists (
    select 1 from public.volunteers v
    where v.id = auth.uid() and v.id = sessions.volunteer_id
  )
  or exists (
    select 1
    from public.organizations o
    join public.drives d on d.org_id = o.id
    where o.id = auth.uid() and d.id = sessions.drive_id
  )
);

drop policy if exists sessions_insert_own on public.sessions;
create policy sessions_insert_own on public.sessions
for insert to authenticated
with check (
  exists (
    select 1 from public.volunteers v
    where v.id = auth.uid() and v.id = sessions.volunteer_id
  )
);

drop policy if exists sessions_update_own on public.sessions;
create policy sessions_update_own on public.sessions
for update to authenticated
using (
  exists (
    select 1 from public.volunteers v
    where v.id = auth.uid() and v.id = sessions.volunteer_id
  )
)
with check (
  exists (
    select 1 from public.volunteers v
    where v.id = auth.uid() and v.id = sessions.volunteer_id
  )
);

