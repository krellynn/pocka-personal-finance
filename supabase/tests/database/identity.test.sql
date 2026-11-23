-- Identity foundation: provisioning (D-04) and two-user RLS isolation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- Users signing up (fires on_auth_user_created). Ana/Budi: isolation pair. Citra/Dewi: roles. Others: edge metadata.
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local', '{"display_name":"Ana"}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'budi@test.local', '{}', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'citra@test.local', '{"display_name":"   "}', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'dewi@test.local', jsonb_build_object('display_name', repeat('d', 100)), 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', null, '{}', 'authenticated', 'authenticated'),
  ('66666666-6666-6666-6666-666666666666', 'eka@test.local', '{"full_name":"Eka Putri"}', 'authenticated', 'authenticated');

-- Provisioning ---------------------------------------------------------------
select is((select count(*)::int from public.workspaces where personal_owner_id = '11111111-1111-1111-1111-111111111111'),
  1, 'sign-up creates exactly one personal workspace');
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ana', 'display name comes from sign-up metadata');
select is((select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'budi', 'display name falls back to email local part');
select is((select display_name from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'citra', 'whitespace-only display name falls back to email');
select is((select char_length(display_name) from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  80, 'long display name is truncated, sign-up still succeeds');
select is((select display_name from public.profiles where id = '55555555-5555-5555-5555-555555555555'),
  'Pengguna', 'user without email gets a default name');
select is((select display_name from public.profiles where id = '66666666-6666-6666-6666-666666666666'),
  'Eka Putri', 'full_name metadata is used');
select is((select role || '/' || status from public.workspace_members where user_id = '11111111-1111-1111-1111-111111111111'),
  'owner/active', 'user is active owner of personal workspace');
select is((select w.base_currency || ' ' || w.timezone || ' ' || w.locale from public.workspaces w
           where personal_owner_id = '11111111-1111-1111-1111-111111111111'),
  'IDR Asia/Jakarta id-ID', 'workspace uses product defaults');
select is((select default_workspace_id from public.user_settings where user_id = '11111111-1111-1111-1111-111111111111'),
  (select id from public.workspaces where personal_owner_id = '11111111-1111-1111-1111-111111111111'),
  'settings point to personal workspace');

-- Retry is idempotent.
select is(private.provision_user('11111111-1111-1111-1111-111111111111', 'ana@test.local', '{}'),
  (select id from public.workspaces where personal_owner_id = '11111111-1111-1111-1111-111111111111'),
  'retry returns the existing workspace');
select is((select count(*)::int from public.workspaces where personal_owner_id = '11111111-1111-1111-1111-111111111111'),
  1, 'retry creates no duplicate workspace');
select is((select count(*)::int from public.workspace_members where user_id = '11111111-1111-1111-1111-111111111111'),
  1, 'retry creates no duplicate membership');
select throws_ok(
  $$insert into public.workspaces (workspace_type, name, personal_owner_id)
    values ('personal', 'Dua', '11111111-1111-1111-1111-111111111111')$$,
  '23505', null, 'database rejects a second personal workspace');

-- Fixtures: Budi's workspace id for guessed-id checks; Dewi as active viewer of Citra's
-- workspace; Citra's own membership marked left so her default workspace goes stale.
create temp table ids as select
  (select id from public.workspaces where personal_owner_id = '22222222-2222-2222-2222-222222222222') as ws_b,
  (select id from public.workspaces where personal_owner_id = '33333333-3333-3333-3333-333333333333') as ws_c;
grant select on ids to authenticated, anon;
select isnt((select ws_b from ids), null, 'fixture: Budi''s workspace id is known');
insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  select ws_c, '44444444-4444-4444-4444-444444444444', 'viewer', 'active', now() from ids;
update public.workspace_members set status = 'left'
  where user_id = '33333333-3333-3333-3333-333333333333' and workspace_id = (select ws_c from ids);

-- As Ana ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select results_eq('select id from public.profiles',
  $$values ('11111111-1111-1111-1111-111111111111'::uuid)$$, 'Ana sees only her profile');
select is((select count(*)::int from public.workspaces), 1, 'Ana sees only her workspace');
select is_empty('select 1 from public.workspaces where id = (select ws_b from ids)',
  'Ana cannot read Budi''s workspace by guessed id');
select is((select count(*)::int from public.workspace_members), 1, 'Ana sees only her membership');
select is((select count(*)::int from public.user_settings), 1, 'Ana sees only her settings');

select is_empty($$update public.profiles set display_name = 'x'
  where id = '22222222-2222-2222-2222-222222222222' returning 1$$, 'Ana cannot update Budi''s profile');
select is_empty($$update public.workspaces set name = 'x' where id = (select ws_b from ids) returning 1$$,
  'Ana cannot rename Budi''s workspace');
select throws_ok($$update public.user_settings set default_workspace_id = (select ws_b from ids)$$,
  '42501', null, 'Ana cannot point her default workspace at Budi''s');
select isnt_empty($$update public.profiles set display_name = 'Ana B'
  where id = '11111111-1111-1111-1111-111111111111' returning 1$$, 'Ana can update her own profile');
select isnt_empty($$update public.workspaces set name = 'Dompet Ana' returning 1$$,
  'Ana can rename her own workspace');
select isnt_empty($$update public.user_settings set theme = 'dark',
  default_workspace_id = (select id from public.workspaces) returning 1$$, 'Ana can update her own settings');

select throws_ok($$insert into public.workspaces (workspace_type, name) values ('household', 'X')$$,
  '42501', null, 'clients cannot create workspaces directly');
select throws_ok('delete from public.workspaces', '42501', null, 'clients cannot delete workspaces');
select throws_ok($$update public.workspaces set personal_owner_id = null$$,
  '42501', null, 'clients cannot change workspace ownership');
select throws_ok($$update public.workspace_members set role = 'owner'$$,
  '42501', null, 'clients cannot change membership roles');
select throws_ok($$insert into public.profiles (id, display_name) values ('22222222-2222-2222-2222-222222222222', 'x')$$,
  '42501', null, 'clients cannot insert profiles');
select throws_ok($$update public.profiles set id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null, 'clients cannot change profile id');
select throws_ok($$select private.provision_user('11111111-1111-1111-1111-111111111111', 'a', '{}')$$,
  '42501', null, 'clients cannot call provisioning');

-- As Dewi (active viewer of Citra's workspace) -------------------------------
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select isnt_empty('select 1 from public.workspaces where id = (select ws_c from ids)',
  'active member can read a shared workspace');
select is_empty($$update public.workspaces set name = 'x' where id = (select ws_c from ids) returning 1$$,
  'viewer cannot rename a workspace');

-- As Citra (default workspace now stale) -------------------------------------
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select isnt_empty($$update public.user_settings set theme = 'dark' returning 1$$,
  'stale default workspace does not block other settings updates');

-- As anonymous ---------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.workspaces', '42501', null, 'anon cannot read workspaces');
select throws_ok('select * from public.workspace_members', '42501', null, 'anon cannot read memberships');
select throws_ok('select * from public.user_settings', '42501', null, 'anon cannot read settings');

select * from finish();
rollback;
