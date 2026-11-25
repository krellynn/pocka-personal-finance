-- G3a budgets: set/delete/copy rules, audit old/new, budget_vs_actual reconciles with period_totals, roles, isolation.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('dddddddd-0000-0000-0000-000000000001', 'budget-ana@test.local', '{}', 'authenticated', 'authenticated'),
  ('dddddddd-0000-0000-0000-000000000002', 'budget-budi@test.local', '{}', 'authenticated', 'authenticated'),
  ('dddddddd-0000-0000-0000-000000000003', 'budget-citra@test.local', '{}', 'authenticated', 'authenticated');
create temp table t (k text primary key, v uuid);
grant all on t to authenticated, anon;
insert into t (k, v) values
  ('ws', (select id from public.workspaces where personal_owner_id = 'dddddddd-0000-0000-0000-000000000001')),
  ('ws_b', (select id from public.workspaces where personal_owner_id = 'dddddddd-0000-0000-0000-000000000002'));
insert into t (k, v) select 'food', id from public.transaction_categories where workspace_id = (select v from t where k = 'ws') and name = 'Makan & Minum';
insert into t (k, v) select 'trans', id from public.transaction_categories where workspace_id = (select v from t where k = 'ws') and name = 'Transportasi';
insert into t (k, v) select 'shop', id from public.transaction_categories where workspace_id = (select v from t where k = 'ws') and name = 'Belanja';
insert into t (k, v) select 'fun', id from public.transaction_categories where workspace_id = (select v from t where k = 'ws') and name = 'Hiburan';
insert into t (k, v) select 'salary', id from public.transaction_categories where workspace_id = (select v from t where k = 'ws') and name = 'Gaji';
insert into t (k, v) select 'food_b', id from public.transaction_categories where workspace_id = (select v from t where k = 'ws_b') and name = 'Makan & Minum';
insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  select v, 'dddddddd-0000-0000-0000-000000000003', 'viewer', 'active', now() from t where k = 'ws';

set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';

-- set_budget: create, update, no-op, delete, all audited with old/new.
select lives_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'food'), '500000')$$, 'create a plan');
select is((select planned_amount from public.budgets where category_id = (select v from t where k = 'food') and period_month = '2026-10-01'), 500000::bigint, 'plan stored');
select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'food'), '750000');
select is((select planned_amount from public.budgets where category_id = (select v from t where k = 'food') and period_month = '2026-10-01'), 750000::bigint, 'plan updated');
select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'food'), '750000');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'set_budget' and entity_id = (select v from t where k = 'food')), 2, 'same value is a no-op without audit');
select is((select details ->> 'old' from public.audit_logs where action = 'set_budget' and entity_id = (select v from t where k = 'food') and details ->> 'new' = '750000'),
  '500000', 'audit keeps the old value');
set local role authenticated;
select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'trans'), '100000');
select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'trans'), '000');
select is((select count(*)::int from public.budgets where category_id = (select v from t where k = 'trans')), 0, '"000" deletes the plan');
select lives_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'trans'), '0')$$, '"0" on a missing plan is a no-op');
reset role;
select is((select details ->> 'new' from public.audit_logs where action = 'set_budget' and entity_id = (select v from t where k = 'trans') and details ->> 'old' = '100000'),
  null, 'deletion audited with new = null');
set local role authenticated;

-- Validation.
select throws_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'food'), '-1')$$, 'P0001', 'VALIDATION_FAILED', 'negative amount rejected');
select throws_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'food'), 'abc')$$, 'P0001', 'VALIDATION_FAILED', 'text amount rejected');
select throws_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-10-15', (select v from t where k = 'food'), '1')$$, 'P0001', 'VALIDATION_FAILED', 'month must be the first day');
select throws_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'salary'), '1')$$, 'P0001', 'VALIDATION_FAILED', 'income category rejected');
select throws_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'food_b'), '1')$$, 'P0001', 'VALIDATION_FAILED', 'foreign category rejected');

-- Archived category: no new or changed plan, but an existing plan can still be removed.
select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'fun'), '200000');
select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'shop'), '300000');
reset role;
update public.transaction_categories set archived_at = now() where id = (select v from t where k = 'fun');
set local role authenticated;
select throws_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-11-01', (select v from t where k = 'fun'), '1')$$, 'P0001', 'RESOURCE_ARCHIVED', 'archived category cannot get a plan');

-- copy_budgets: Oct has food 750k, shop 300k, fun (archived) 200k; Nov already has shop 999.
select public.set_budget((select v from t where k = 'ws'), '2026-11-01', (select v from t where k = 'shop'), '999');
select is((public.copy_budgets((select v from t where k = 'ws'), '2026-10-01', '2026-11-01') ->> 'copied')::int, 1, 'copies only the missing active category');
select is((select planned_amount from public.budgets where category_id = (select v from t where k = 'shop') and period_month = '2026-11-01'), 999::bigint, 'existing plan kept');
select is((select count(*)::int from public.budgets where category_id = (select v from t where k = 'fun') and period_month = '2026-11-01'), 0, 'archived category skipped');
select is((public.copy_budgets((select v from t where k = 'ws'), '2026-10-01', '2026-11-01') ->> 'copied')::int, 0, 'rerun copies nothing');
select throws_ok($$select public.copy_budgets((select v from t where k = 'ws'), '2026-10-01', '2026-10-01')$$, 'P0001', 'VALIDATION_FAILED', 'same month rejected');
select lives_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'fun'), '0')$$, 'archived category plan can be removed');

-- budget_vs_actual for Oct: food plan 750k spent 800k - refund 100k; trans no plan spent 50k; shop plan 300k no spend; Nov spend excluded.
insert into t (k, v) select 'bank', (public.create_financial_account((select v from t where k = 'ws'), 'bg-acc-0001', 'bank', 'BCA', '5000000', '2026-09-01') ->> 'financial_account_id')::uuid;
insert into t (k, v) select 'e1', (public.post_expense((select v from t where k = 'ws'), 'bg-exp-0001', (select v from t where k = 'bank'), (select v from t where k = 'food'), '800000', '2026-10-05') ->> 'transaction_id')::uuid;
select public.post_refund((select v from t where k = 'ws'), 'bg-ref-0001', (select v from t where k = 'e1'), '100000', null, '2026-10-06');
select public.post_expense((select v from t where k = 'ws'), 'bg-exp-0002', (select v from t where k = 'bank'), (select v from t where k = 'trans'), '50000', '2026-10-07');
select public.post_expense((select v from t where k = 'ws'), 'bg-exp-0003', (select v from t where k = 'bank'), (select v from t where k = 'shop'), '70000', '2026-11-02');
select public.post_income((select v from t where k = 'ws'), 'bg-inc-0001', (select v from t where k = 'bank'), (select v from t where k = 'salary'), '9000000', '2026-10-01');

select results_eq(
  $$select category_name, has_budget, planned, actual, remaining, is_over from public.budget_vs_actual((select v from t where k = 'ws'), '2026-10-01')$$,
  $$values ('Belanja'::text, true, '300000'::text, '0'::text, '300000'::text, false),
           ('Makan & Minum', true, '750000', '700000', '50000', false),
           ('Transportasi', false, null, '50000', null, false)$$,
  'budget vs actual rows, unbudgeted spending last, no income');
select is((select sum(actual::bigint) from public.budget_vs_actual((select v from t where k = 'ws'), '2026-10-01')),
  (select sum(total::bigint) from public.period_totals((select v from t where k = 'ws'), '2026-10-01', '2026-10-31') where kind = 'expense'),
  'actual reconciles with period_totals');
select results_eq($$select category_id, planned, actual from public.budget_vs_actual((select v from t where k = 'ws'), '2026-10-17')$$,
  $$select category_id, planned, actual from public.budget_vs_actual((select v from t where k = 'ws'), '2026-10-01')$$, 'a mid-month date means that month');
select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'food'), '600000');
select is((select is_over from public.budget_vs_actual((select v from t where k = 'ws'), '2026-10-01') where category_id = (select v from t where k = 'food')), true, 'over budget flagged');
select is((select remaining from public.budget_vs_actual((select v from t where k = 'ws'), '2026-10-01') where category_id = (select v from t where k = 'food')), '-100000', 'remaining goes negative');

-- Roles and isolation.
reset role;
set local role authenticated;
select throws_ok($$insert into public.budgets (workspace_id, period_month, category_id, planned_amount, currency) values ((select v from t where k = 'ws'), '2026-12-01', (select v from t where k = 'food'), 1, 'IDR')$$,
  '42501', null, 'clients cannot insert directly');
select throws_ok($$delete from public.budgets$$, '42501', null, 'clients cannot delete directly');
set local request.jwt.claims = '{"sub":"dddddddd-0000-0000-0000-000000000003","role":"authenticated"}';
select ok((select count(*) from public.budgets where workspace_id = (select v from t where k = 'ws')) > 0, 'viewer reads budgets');
select ok((select count(*) from public.budget_vs_actual((select v from t where k = 'ws'), '2026-10-01')) > 0, 'viewer reads budget vs actual');
select throws_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'food'), '1')$$, 'P0001', 'WORKSPACE_ACCESS_DENIED', 'viewer cannot set');
select throws_ok($$select public.copy_budgets((select v from t where k = 'ws'), '2026-10-01', '2026-12-01')$$, 'P0001', 'WORKSPACE_ACCESS_DENIED', 'viewer cannot copy');
set local request.jwt.claims = '{"sub":"dddddddd-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.budgets where workspace_id = (select v from t where k = 'ws')), 0, 'other users see no budgets');
select is_empty($$select * from public.budget_vs_actual((select v from t where k = 'ws'), '2026-10-01')$$, 'other users see no budget vs actual');
select throws_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'food'), '1')$$, 'P0001', 'WORKSPACE_ACCESS_DENIED', 'other users cannot set');

-- IDR only.
reset role;
alter table public.workspaces disable trigger workspaces_lock_base_currency; -- simulate a non-IDR workspace (rolled back)
update public.workspaces set base_currency = 'USD' where id = (select v from t where k = 'ws_b');
alter table public.workspaces enable trigger workspaces_lock_base_currency;
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$select public.set_budget((select v from t where k = 'ws_b'), '2026-10-01', (select v from t where k = 'food_b'), '1')$$, 'P0001', 'CURRENCY_NOT_SUPPORTED', 'non-IDR workspace cannot budget');

reset role;
set local role anon;
select throws_ok($$select public.set_budget((select v from t where k = 'ws'), '2026-10-01', (select v from t where k = 'food'), '1')$$, '42501', null, 'anon cannot execute');

select * from finish();
rollback;
