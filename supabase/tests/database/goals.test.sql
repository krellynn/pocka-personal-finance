-- G3b goals: create/update/archive rules, pocket link integrity, idempotency, audit, progress math, roles, isolation.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('ffffffff-0000-0000-0000-000000000001', 'goal-ana@test.local', '{}', 'authenticated', 'authenticated'),
  ('ffffffff-0000-0000-0000-000000000002', 'goal-budi@test.local', '{}', 'authenticated', 'authenticated'),
  ('ffffffff-0000-0000-0000-000000000003', 'goal-citra@test.local', '{}', 'authenticated', 'authenticated');
create temp table t (k text primary key, v uuid);
grant all on t to authenticated, anon;
insert into t (k, v) values
  ('ws', (select id from public.workspaces where personal_owner_id = 'ffffffff-0000-0000-0000-000000000001')),
  ('ws_b', (select id from public.workspaces where personal_owner_id = 'ffffffff-0000-0000-0000-000000000002'));
insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  select v, 'ffffffff-0000-0000-0000-000000000003', 'viewer', 'active', now() from t where k = 'ws';

set local role authenticated;
set local request.jwt.claims = '{"sub":"ffffffff-0000-0000-0000-000000000001","role":"authenticated"}';
insert into t (k, v) select 'p1', (public.create_pocket((select v from t where k = 'ws'), 'gl-pk-0001', 'Darurat') ->> 'pocket_id')::uuid;
insert into t (k, v) select 'p2', (public.create_pocket((select v from t where k = 'ws'), 'gl-pk-0002', 'Liburan') ->> 'pocket_id')::uuid;

-- create_goal ---------------------------------------------------------------------------
select lives_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0001', '  Dana Darurat ', '5000000', '2099-01-01', ' catatan ', (select v from t where k = 'p1'))$$, 'create a linked goal');
insert into t (k, v) select 'g1', id from public.goals where name = 'Dana Darurat';
select is((select target_amount from public.goals where id = (select v from t where k = 'g1')), 5000000::bigint, 'target stored as bigint');
select is((select notes from public.goals where id = (select v from t where k = 'g1')), 'catatan', 'note trimmed');
select is((public.create_goal((select v from t where k = 'ws'), 'gl-key-0001', 'Dana Darurat', '5000000', '2099-01-01', 'catatan', (select v from t where k = 'p1')) ->> 'replayed')::boolean, true, 'same key and fields replays');
select is((select count(*)::int from public.goals), 1, 'replay creates nothing');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0001', 'Lain', '5000000')$$, 'P0001', null, 'same key with other fields is rejected');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0002', 'dana darurat', '1')$$, 'P0001', 'VALIDATION_FAILED', 'duplicate name (any case) rejected');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0003', 'Mobil', '1', null, null, (select v from t where k = 'p1'))$$, 'P0001', 'POCKET_ALREADY_LINKED', 'a pocket links to one active goal');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0004', '', '1')$$, 'P0001', 'VALIDATION_FAILED', 'empty name rejected');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0005', repeat('a', 61), '1')$$, 'P0001', 'VALIDATION_FAILED', 'name over 60 rejected');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0006', 'X', '0')$$, 'P0001', 'VALIDATION_FAILED', 'zero target rejected');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0007', 'X', '-5')$$, 'P0001', 'VALIDATION_FAILED', 'negative target rejected');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0008', 'X', '1000000000000000')$$, 'P0001', 'VALIDATION_FAILED', 'target over 15 digits rejected');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0009', 'X', '1', '2000-01-01')$$, 'P0001', 'VALIDATION_FAILED', 'past date rejected');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0010', 'X', '1', '2101-01-01')$$, 'P0001', 'VALIDATION_FAILED', 'date after 2100 rejected');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0011', 'X', '1', null, repeat('n', 501))$$, 'P0001', 'VALIDATION_FAILED', 'note over 500 rejected');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0012', 'X', '1', null, null, gen_random_uuid())$$, 'P0001', 'VALIDATION_FAILED', 'unknown pocket rejected');
select throws_ok($$select public.create_goal((select v from t where k = 'ws_b'), 'gl-key-0013', 'X', '1')$$, 'P0001', null, 'foreign workspace rejected');
select lives_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0014', 'Mobil', '100')$$, 'unlinked goal is allowed');
insert into t (k, v) select 'g2', id from public.goals where name = 'Mobil';

-- update_goal ---------------------------------------------------------------------------
select public.update_goal((select v from t where k = 'ws'), (select v from t where k = 'g2'), 'Mobil Baru', '200', null, null, (select v from t where k = 'p2'));
select is((select name from public.goals where id = (select v from t where k = 'g2')), 'Mobil Baru', 'rename stored');
select is((select pocket_id from public.goals where id = (select v from t where k = 'g2')), (select v from t where k = 'p2'), 'link stored');
reset role;
select is((select details from public.audit_logs where action = 'update_goal' and entity_id = (select v from t where k = 'g2')),
  jsonb_build_object('name', '{"old": "Mobil", "new": "Mobil Baru"}'::jsonb, 'target', '{"old": "100", "new": "200"}'::jsonb,
                     'pocket', jsonb_build_object('old', null, 'new', (select v from t where k = 'p2'))), 'audit lists changed fields only');
set local role authenticated;
select public.update_goal((select v from t where k = 'ws'), (select v from t where k = 'g2'), 'Mobil Baru', '200', null, null, (select v from t where k = 'p2'));
reset role;
select is((select count(*)::int from public.audit_logs where action = 'update_goal' and entity_id = (select v from t where k = 'g2')), 1, 'no-op update writes no audit row');
set local role authenticated;
select throws_ok($$select public.update_goal((select v from t where k = 'ws'), (select v from t where k = 'g2'), 'Dana Darurat', '200')$$, 'P0001', 'VALIDATION_FAILED', 'rename onto an active name rejected');
select throws_ok($$select public.update_goal((select v from t where k = 'ws'), (select v from t where k = 'g2'), 'Mobil Baru', '200', null, null, (select v from t where k = 'p1'))$$, 'P0001', 'POCKET_ALREADY_LINKED', 'cannot steal a linked pocket');
select throws_ok($$select public.update_goal((select v from t where k = 'ws'), gen_random_uuid(), 'X', '1')$$, 'P0001', 'VALIDATION_FAILED', 'unknown goal rejected');
-- An old past target date survives an unrelated edit.
reset role;
update public.goals set target_date = '2020-01-01' where id = (select v from t where k = 'g2');
set local role authenticated;
select lives_ok($$select public.update_goal((select v from t where k = 'ws'), (select v from t where k = 'g2'), 'Mobil Baru', '300', '2020-01-01', null, (select v from t where k = 'p2'))$$, 'unchanged past date is kept');

-- Pocket archive vs goal link -----------------------------------------------------------
select throws_ok($$select public.set_pocket_archived((select v from t where k = 'ws'), (select v from t where k = 'p1'), true)$$, 'P0001', 'POCKET_LINKED_TO_GOAL', 'linked pocket cannot be archived');

-- Archive / unarchive -------------------------------------------------------------------
select public.set_goal_archived((select v from t where k = 'ws'), (select v from t where k = 'g1'), true);
select is((select pocket_id from public.goals where id = (select v from t where k = 'g1')), null, 'archive releases the pocket link');
reset role;
select is((select details ->> 'released_pocket' from public.audit_logs where action = 'archive_goal' and entity_id = (select v from t where k = 'g1')),
  (select v::text from t where k = 'p1'), 'released pocket recorded in audit');
set local role authenticated;
select lives_ok($$select public.set_pocket_archived((select v from t where k = 'ws'), (select v from t where k = 'p1'), true)$$, 'pocket can be archived once the goal is archived');
select throws_ok($$select public.update_goal((select v from t where k = 'ws'), (select v from t where k = 'g1'), 'Dana Darurat', '1')$$, 'P0001', 'RESOURCE_ARCHIVED', 'archived goal is not editable');
select public.create_goal((select v from t where k = 'ws'), 'gl-key-0015', 'dana darurat', '1');
select throws_ok($$select public.set_goal_archived((select v from t where k = 'ws'), (select v from t where k = 'g1'), false)$$, 'P0001', 'VALIDATION_FAILED', 'unarchive onto an active name rejected');
select public.set_goal_archived((select v from t where k = 'ws'), (select id from public.goals where name = 'dana darurat'), true);
select lives_ok($$select public.set_goal_archived((select v from t where k = 'ws'), (select v from t where k = 'g1'), false)$$, 'unarchive works once the name is free');
select is((select pocket_id from public.goals where id = (select v from t where k = 'g1')), null, 'unarchived goal comes back unlinked');
select lives_ok($$select public.set_goal_archived((select v from t where k = 'ws'), (select v from t where k = 'g1'), false)$$, 'repeat unarchive is a no-op');

-- Progress view -------------------------------------------------------------------------
reset role;
insert into public.pocket_movements (workspace_id, from_pocket_id, to_pocket_id, amount, currency, created_by)
  values ((select v from t where k = 'ws'), null, (select v from t where k = 'p2'), 150, 'IDR', 'ffffffff-0000-0000-0000-000000000001');
set local role authenticated;
select is((select saved from public.goal_progress where id = (select v from t where k = 'g2')), '150', 'saved = pocket balance');
select is((select remaining from public.goal_progress where id = (select v from t where k = 'g2')), '150', 'remaining = target - saved');
select is((select percent from public.goal_progress where id = (select v from t where k = 'g2')), 50, 'percent');
select is((select saved from public.goal_progress where id = (select v from t where k = 'g1')), '0', 'unlinked goal shows 0 saved');
select is((select percent from public.goal_progress where id = (select v from t where k = 'g1')), 0, 'unlinked goal shows 0 percent');
reset role;
update public.goals set target_amount = 151 where id = (select v from t where k = 'g2');
set local role authenticated;
select is((select percent from public.goal_progress where id = (select v from t where k = 'g2')), 99, 'percent floors, never 100 before the target');
select is((select is_reached from public.goal_progress where id = (select v from t where k = 'g2')), false, 'not reached below target');
reset role;
update public.goals set target_amount = 150 where id = (select v from t where k = 'g2');
set local role authenticated;
select is((select is_reached from public.goal_progress where id = (select v from t where k = 'g2')), true, 'reached at target');
reset role;
insert into public.pocket_movements (workspace_id, from_pocket_id, to_pocket_id, amount, currency, created_by)
  values ((select v from t where k = 'ws'), null, (select v from t where k = 'p2'), 999999999999849, 'IDR', 'ffffffff-0000-0000-0000-000000000001');
update public.goals set target_amount = 999999999999999 where id = (select v from t where k = 'g2');
set local role authenticated;
select is((select saved from public.goal_progress where id = (select v from t where k = 'g2')), '999999999999999', '15-digit saved is exact');
select is((select percent from public.goal_progress where id = (select v from t where k = 'g2')), 100, '15-digit target reached = 100');
select is((select remaining from public.goal_progress where id = (select v from t where k = 'g2')), '0', 'remaining never negative');

-- Roles, grants, isolation --------------------------------------------------------------
select throws_ok($$insert into public.goals (workspace_id, name, target_amount, currency) values ((select v from t where k = 'ws'), 'Langsung', 1, 'IDR')$$, '42501', null, 'direct insert denied');
select throws_ok($$update public.goals set name = 'Hack'$$, '42501', null, 'direct update denied');
select throws_ok($$delete from public.goals$$, '42501', null, 'direct delete denied');
reset role;
select throws_ok($$delete from public.goals$$, 'P0001', 'POSTED_ENTRY_IMMUTABLE', 'goals cannot be deleted at all');
set local role authenticated;
set local request.jwt.claims = '{"sub":"ffffffff-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.goals), 3, 'viewer can read goals');
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0020', 'Viewer', '1')$$, 'P0001', null, 'viewer cannot create');
select throws_ok($$select public.update_goal((select v from t where k = 'ws'), (select v from t where k = 'g1'), 'Viewer', '1')$$, 'P0001', null, 'viewer cannot update');
select throws_ok($$select public.set_goal_archived((select v from t where k = 'ws'), (select v from t where k = 'g1'), true)$$, 'P0001', null, 'viewer cannot archive');
set local request.jwt.claims = '{"sub":"ffffffff-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.goals), 0, 'other workspace sees nothing');
select is((select count(*)::int from public.goal_progress), 0, 'other workspace sees no progress');
select throws_ok($$select public.update_goal((select v from t where k = 'ws'), (select v from t where k = 'g1'), 'Intruder', '1')$$, 'P0001', null, 'foreign user cannot update');
reset role;
set local role anon;
select throws_ok($$select public.create_goal((select v from t where k = 'ws'), 'gl-key-0021', 'Anon', '1')$$, '42501', null, 'anon cannot call create_goal');
select throws_ok($$select * from public.goal_progress$$, '42501', null, 'anon cannot read progress');
reset role;

select * from finish();
rollback;
