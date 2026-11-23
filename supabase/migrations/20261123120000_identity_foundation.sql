-- Phase 0B identity foundation: profiles, personal workspace, membership and settings.
-- D-04: exactly one personal workspace per user, provisioned transactionally and idempotently on sign-up.
-- RLS is the security boundary; clients get explicit, column-scoped grants only.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workspaces ----------------------------------------------------------------
-- Workspace/membership FKs to auth.users have no cascade: whole-user deletion vs. the
-- immutable ledger is a pending product-owner decision, so deleting such a user fails loudly.
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_type text not null check (workspace_type in ('personal', 'household')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  base_currency char(3) not null default 'IDR' check (base_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Jakarta',
  locale text not null default 'id-ID',
  personal_owner_id uuid unique references auth.users (id),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_personal_owner_check
    check ((workspace_type = 'personal') = (personal_owner_id is not null))
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id),
  user_id uuid not null references auth.users (id),
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  status text not null check (status in ('invited', 'active', 'left', 'removed')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_status_idx on public.workspace_members (user_id, status);

-- Settings ------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  locale text not null default 'id-ID' check (locale in ('id-ID', 'en-US')),
  default_workspace_id uuid references public.workspaces (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function private.set_updated_at();

-- Provisioning --------------------------------------------------------------
-- Idempotent: every insert is ON CONFLICT DO NOTHING and personal_owner_id is UNIQUE,
-- so a retry can never create a second personal workspace.
create function private.provision_user(p_user_id uuid, p_email text, p_meta jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(coalesce(
    nullif(btrim(p_meta ->> 'display_name'), ''),
    nullif(btrim(p_meta ->> 'full_name'), ''),
    nullif(btrim(p_meta ->> 'name'), ''),
    nullif(btrim(split_part(p_email, '@', 1)), ''),
    'Pengguna'), 80);
  v_workspace_id uuid;
begin
  insert into public.profiles (id, display_name)
    values (p_user_id, v_name)
    on conflict (id) do nothing;

  insert into public.workspaces (workspace_type, name, personal_owner_id, created_by)
    values ('personal', 'Pribadi', p_user_id, p_user_id)
    on conflict (personal_owner_id) do nothing;

  select id into strict v_workspace_id
    from public.workspaces where personal_owner_id = p_user_id;

  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
    values (v_workspace_id, p_user_id, 'owner', 'active', now())
    on conflict (workspace_id, user_id) do nothing;

  insert into public.user_settings (user_id, default_workspace_id)
    values (p_user_id, v_workspace_id)
    on conflict (user_id) do nothing;

  return v_workspace_id;
end $$;
revoke all on function private.provision_user(uuid, text, jsonb) from public, anon, authenticated;

-- Runs inside the sign-up transaction: if provisioning fails, the sign-up fails too.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.provision_user(new.id, new.email, new.raw_user_meta_data);
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Backfill users that existed before this migration (idempotent).
select private.provision_user(id, email, raw_user_meta_data) from auth.users;

-- Validate default_workspace_id only when it changes, so a stale default (membership
-- later left/removed) never blocks unrelated settings updates. Runs as the caller, under RLS.
create function private.check_default_workspace() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.default_workspace_id is not null
     and new.default_workspace_id is distinct from old.default_workspace_id
     and not exists (
       select 1 from public.workspace_members m
       where m.workspace_id = new.default_workspace_id
         and m.user_id = new.user_id
         and m.status = 'active') then
    raise exception 'default workspace must be one you are an active member of'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger user_settings_check_default_workspace before update on public.user_settings
  for each row execute function private.check_default_workspace();

-- Row-level security --------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.user_settings enable row level security;

create policy "profiles: owner reads" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: owner updates" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "workspace_members: user reads own memberships" on public.workspace_members
  for select to authenticated using (user_id = (select auth.uid()));

create policy "workspaces: active members read" on public.workspaces
  for select to authenticated using (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = workspaces.id
      and m.user_id = (select auth.uid())
      and m.status = 'active'));
create policy "workspaces: owners and admins update" on public.workspaces
  for update to authenticated
  using (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = workspaces.id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'admin')))
  with check (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = workspaces.id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'admin')));

create policy "user_settings: owner reads" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_settings: owner updates" on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Grants: nothing for anon; no client insert/delete (rows come only from provisioning).
revoke all on public.profiles, public.workspaces, public.workspace_members, public.user_settings
  from public, anon, authenticated;
grant select, update (display_name, avatar_url) on public.profiles to authenticated;
grant select, update (name) on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select, update (theme, locale, default_workspace_id) on public.user_settings to authenticated;
