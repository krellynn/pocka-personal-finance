-- G3a pockets (docs/G3A_POCKETS_BUDGETS_DRAFT_V1.md): eligible funds (D-16), shortfall rule, moves,
-- archive guard, idempotency, no ledger effect, isolation, roles.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('cccccccc-0000-0000-0000-000000000001', 'pocket-ana@test.local', '{}', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000002', 'pocket-budi@test.local', '{}', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'pocket-citra@test.local', '{}', 'authenticated', 'authenticated');
create temp table t (k text primary key, v uuid, j jsonb);
grant all on t to authenticated, anon;
insert into t (k, v) values
  ('ws', (select id from public.workspaces where personal_owner_id = 'cccccccc-0000-0000-0000-000000000001')),
  ('ws_b', (select id from public.workspaces where personal_owner_id = 'cccccccc-0000-0000-0000-000000000002'));
insert into t (k, v) select 'food', id from public.transaction_categories where workspace_id = (select v from t where k = 'ws') and name = 'Makan & Minum';
insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  select v, 'cccccccc-0000-0000-0000-000000000003', 'viewer', 'active', now() from t where k = 'ws';

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';

-- Eligible funds: bank 1.000.000 + cash -100.000 + e-wallet 50.000; card and archived account excluded.
insert into t (k, v) select 'bank', (public.create_financial_account((select v from t where k = 'ws'), 'pk-acc-0001', 'bank', 'BCA', '1000000') ->> 'financial_account_id')::uuid;
insert into t (k, v) select 'cash', (public.create_financial_account((select v from t where k = 'ws'), 'pk-acc-0002', 'cash', 'Kas', '-100000') ->> 'financial_account_id')::uuid;
insert into t (k, v) select 'ewallet', (public.create_financial_account((select v from t where k = 'ws'), 'pk-acc-0003', 'ewallet', 'OVO', '50000') ->> 'financial_account_id')::uuid;
insert into t (k, v) select 'card', (public.create_financial_account((select v from t where k = 'ws'), 'pk-acc-0004', 'credit_card', 'Visa', '-70000') ->> 'financial_account_id')::uuid;
insert into t (k, v) select 'old', (public.create_financial_account((select v from t where k = 'ws'), 'pk-acc-0005', 'bank', 'Lama') ->> 'financial_account_id')::uuid;
select public.set_financial_account_archived((select v from t where k = 'ws'), (select v from t where k = 'old'), true);

select is((select eligible_funds from public.pocket_summary where workspace_id = (select v from t where k = 'ws')), '950000',
  'eligible funds: cash-like balances, negatives reduce, cards and archived excluded');
reset role;
select is(private.eligible_funds((select v from t where k = 'ws'))::text,
  (select eligible_funds from public.pocket_summary where workspace_id = (select v from t where k = 'ws')), 'RPC formula matches the view');
set local role authenticated;

-- Pockets
insert into t (k, j) values ('p1', public.create_pocket((select v from t where k = 'ws'), 'pk-new-0001', ' Darurat ', '500000'));
update t set v = (j ->> 'pocket_id')::uuid where k = 'p1';
insert into t (k, v) select 'p2', (public.create_pocket((select v from t where k = 'ws'), 'pk-new-0002', 'Liburan') ->> 'pocket_id')::uuid;
select is((select name from public.pockets where id = (select v from t where k = 'p1')), 'Darurat', 'name is trimmed');
select is((public.create_pocket((select v from t where k = 'ws'), 'pk-new-0001', ' Darurat ', '500000') ->> 'replayed')::boolean, true, 'create replays');
select throws_ok($$select public.create_pocket((select v from t where k = 'ws'), 'pk-new-0003', 'darurat')$$, 'P0001', 'VALIDATION_FAILED', 'name unique among active pockets');

-- Shortfall rule: allocate up to exactly eligible, not one more.
select lives_ok($$select public.allocate_to_pocket((select v from t where k = 'ws'), 'pk-mov-0001', (select v from t where k = 'p1'), '900000')$$, 'allocate within eligible');
select throws_ok($$select public.allocate_to_pocket((select v from t where k = 'ws'), 'pk-mov-0002', (select v from t where k = 'p2'), '50001')$$,
  'P0001', 'ALLOCATION_EXCEEDS_ELIGIBLE', 'cannot allocate past eligible');
select is(public.allocate_to_pocket((select v from t where k = 'ws'), 'pk-mov-0003', (select v from t where k = 'p2'), '50000') ->> 'unallocated', '0', 'allocate exactly to eligible');
select is((public.allocate_to_pocket((select v from t where k = 'ws'), 'pk-mov-0003', (select v from t where k = 'p2'), '50000') ->> 'replayed')::boolean, true, 'allocation replays without a second row');
select throws_ok($$select public.allocate_to_pocket((select v from t where k = 'ws'), 'pk-mov-0003', (select v from t where k = 'p2'), '40000')$$,
  'P0001', 'IDEMPOTENCY_CONFLICT', 'same key, different amount conflicts');

-- No ledger effect.
select is((select count(*)::int from public.journal_lines jl join public.journal_entries je on je.id = jl.journal_entry_id
            where je.workspace_id = (select v from t where k = 'ws')), 8, 'pocket commands write no journal lines (only the 4 nonzero openings x 2)');
select is((select balance from public.account_balances where id = (select v from t where k = 'bank')), '1000000', 'account balances unchanged');

-- Spending creates a shortfall; then allocate fails, deallocate and move still work.
select public.post_expense((select v from t where k = 'ws'), 'pk-exp-0001', (select v from t where k = 'bank'), (select v from t where k = 'food'), '200000');
select is((select unallocated from public.pocket_summary where workspace_id = (select v from t where k = 'ws')), '-200000', 'spending shows a shortfall');
select is((select is_shortfall from public.pocket_summary where workspace_id = (select v from t where k = 'ws')), true, 'shortfall flagged');
select throws_ok($$select public.allocate_to_pocket((select v from t where k = 'ws'), 'pk-mov-0004', (select v from t where k = 'p2'), '1')$$,
  'P0001', 'ALLOCATION_EXCEEDS_ELIGIBLE', 'no allocation during a shortfall');
select lives_ok($$select public.move_between_pockets((select v from t where k = 'ws'), 'pk-mov-0005', (select v from t where k = 'p1'), (select v from t where k = 'p2'), '100000')$$,
  'move allowed during a shortfall');
select lives_ok($$select public.deallocate_from_pocket((select v from t where k = 'ws'), 'pk-mov-0006', (select v from t where k = 'p1'), '150000')$$,
  'deallocate allowed during a shortfall');
select is((select balance from public.pocket_balances where id = (select v from t where k = 'p1')), '650000', 'pocket balance = in - out');
select is((select balance from public.pocket_balances where id = (select v from t where k = 'p2')), '150000', 'moved amount arrives');
select is((select unallocated from public.pocket_summary where workspace_id = (select v from t where k = 'ws')), '-50000', 'deallocation reduces the shortfall');
select throws_ok($$select public.deallocate_from_pocket((select v from t where k = 'ws'), 'pk-mov-0007', (select v from t where k = 'p2'), '150001')$$,
  'P0001', 'POCKET_INSUFFICIENT', 'a pocket never goes below zero');
select throws_ok($$select public.move_between_pockets((select v from t where k = 'ws'), 'pk-mov-0008', (select v from t where k = 'p2'), (select v from t where k = 'p2'), '1')$$,
  'P0001', 'VALIDATION_FAILED', 'move needs two different pockets');

-- Archive guard and unarchive.
select throws_ok($$select public.set_pocket_archived((select v from t where k = 'ws'), (select v from t where k = 'p2'), true)$$,
  'P0001', 'RESOURCE_HAS_BALANCE', 'cannot archive a pocket with money in it');
select public.deallocate_from_pocket((select v from t where k = 'ws'), 'pk-mov-0009', (select v from t where k = 'p2'), '150000');
select lives_ok($$select public.set_pocket_archived((select v from t where k = 'ws'), (select v from t where k = 'p2'), true)$$, 'archive an empty pocket');
select throws_ok($$select public.allocate_to_pocket((select v from t where k = 'ws'), 'pk-mov-0010', (select v from t where k = 'p2'), '1')$$,
  'P0001', 'RESOURCE_ARCHIVED', 'archived pocket takes no allocation');
select lives_ok($$select public.create_pocket((select v from t where k = 'ws'), 'pk-new-0004', 'Liburan')$$, 'archived name is free again');
select throws_ok($$select public.set_pocket_archived((select v from t where k = 'ws'), (select v from t where k = 'p2'), false)$$,
  'P0001', 'VALIDATION_FAILED', 'unarchive re-checks the name');

-- Rename via column grant; other columns and deletes are refused.
update public.pockets set name = 'Dana Darurat' where id = (select v from t where k = 'p1');
select is((select name from public.pockets where id = (select v from t where k = 'p1')), 'Dana Darurat', 'writer can rename');
select throws_ok($$update public.pockets set archived_at = now() where id = (select v from t where k = 'p1')$$, '42501', null, 'archive only through the RPC');
select throws_ok($$insert into public.pocket_movements (workspace_id, to_pocket_id, amount, currency, created_by)
  values ((select v from t where k = 'ws'), (select v from t where k = 'p1'), 1, 'IDR', auth.uid())$$, '42501', null, 'no direct movement inserts');

-- Movements are immutable even for the owner of the tables.
reset role;
select throws_ok($$update public.pocket_movements set amount = 1$$, 'P0001', 'POSTED_ENTRY_IMMUTABLE', 'movements are immutable');
set local role authenticated;

-- IDR only (G3a scope).
reset role;
alter table public.workspaces disable trigger workspaces_lock_base_currency; -- simulate a non-IDR workspace (rolled back)
update public.workspaces set base_currency = 'USD' where id = (select v from t where k = 'ws_b');
alter table public.workspaces enable trigger workspaces_lock_base_currency;
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$select public.create_pocket((select v from t where k = 'ws_b'), 'pk-new-0007', 'Dollar')$$, 'P0001', 'CURRENCY_NOT_SUPPORTED', 'non-IDR workspace cannot create pockets');
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';

-- Isolation and roles.
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.pockets where workspace_id = (select v from t where k = 'ws')), 0, 'other users see no pockets');
select is((select count(*)::int from public.pocket_summary where workspace_id = (select v from t where k = 'ws')), 0, 'other users see no summary');
select throws_ok($$select public.allocate_to_pocket((select v from t where k = 'ws'), 'pk-mov-0011', (select v from t where k = 'p1'), '1')$$,
  'P0001', 'WORKSPACE_ACCESS_DENIED', 'other users cannot allocate');
select throws_ok($$select public.allocate_to_pocket((select v from t where k = 'ws_b'), 'pk-mov-0012', (select v from t where k = 'p1'), '1')$$,
  'P0001', 'VALIDATION_FAILED', 'a foreign pocket id is unknown in your own workspace');
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.pockets where workspace_id = (select v from t where k = 'ws')), 3, 'viewer reads pockets');
select throws_ok($$select public.create_pocket((select v from t where k = 'ws'), 'pk-new-0005', 'X')$$, 'P0001', 'WORKSPACE_ACCESS_DENIED', 'viewer cannot write');
reset role;
set local role anon;
select throws_ok($$select public.create_pocket((select v from t where k = 'ws'), 'pk-new-0006', 'X')$$, '42501', null, 'anon cannot execute');

select * from finish();
rollback;
