-- G2a ledger (docs/G2A_FINANCE_CORE_DRAFT_V1.md): provisioning, posting rules and the worked
-- example, D-14/D-15 guards, idempotency, edits, reconciliation, isolation, grants, immutability.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana-ledger@test.local', '{"display_name":"Ana"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'budi-ledger@test.local', '{}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'citra-ledger@test.local', '{}', 'authenticated', 'authenticated');

-- Scratch table for ids and RPC results, usable by every role in this test.
create temp table t (k text primary key, v uuid, j jsonb);
grant all on t to authenticated, anon;
insert into t (k, v) values
  ('ws_a', (select id from public.workspaces where personal_owner_id = 'aaaaaaaa-0000-0000-0000-000000000001')),
  ('ws_b', (select id from public.workspaces where personal_owner_id = 'aaaaaaaa-0000-0000-0000-000000000002'));
insert into t (k, v) select 'cat_food', id from public.transaction_categories
  where workspace_id = (select v from t where k = 'ws_a') and name = 'Makan & Minum';
insert into t (k, v) select 'cat_transport', id from public.transaction_categories
  where workspace_id = (select v from t where k = 'ws_a') and name = 'Transportasi';
insert into t (k, v) select 'cat_salary', id from public.transaction_categories
  where workspace_id = (select v from t where k = 'ws_a') and name = 'Gaji';
-- Citra is a viewer of Ana's workspace (read access, no writes).
insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  select v, 'aaaaaaaa-0000-0000-0000-000000000003', 'viewer', 'active', now() from t where k = 'ws_a';

-- Provisioning ------------------------------------------------------------------
select is((select count(*)::int from public.ledger_accounts where workspace_id = (select v from t where k = 'ws_a') and system_code is not null),
  3, 'sign-up creates the three system ledger accounts');
select is((select count(*)::int from public.transaction_categories where workspace_id = (select v from t where k = 'ws_a')),
  12, 'sign-up seeds 12 default categories');
select lives_ok($$select private.provision_ledger((select v from t where k = 'ws_a'))$$, 'provisioning can be rerun');
select is((select count(*)::int from public.transaction_categories where workspace_id = (select v from t where k = 'ws_a')),
  12, 'rerun creates no duplicate categories');

-- As Ana: the worked example (§3) ----------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

insert into t (k, j) values ('r_bca', public.create_financial_account((select v from t where k = 'ws_a'), 'key-bca-0001', 'bank', 'BCA'));
update t set v = (j ->> 'financial_account_id')::uuid where k = 'r_bca';
insert into t (k, j) values ('r_card', public.create_financial_account((select v from t where k = 'ws_a'), 'key-card-001', 'credit_card', 'Kartu'));
update t set v = (j ->> 'financial_account_id')::uuid where k = 'r_card';

insert into t (k, j) values ('salary', public.post_income((select v from t where k = 'ws_a'), 'key-salary-1',
  (select v from t where k = 'r_bca'), (select v from t where k = 'cat_salary'), '8500000'));
update t set v = (j ->> 'transaction_id')::uuid where k = 'salary';
insert into t (k, j) values ('food', public.post_expense((select v from t where k = 'ws_a'), 'key-food-001',
  (select v from t where k = 'r_card'), (select v from t where k = 'cat_food'), '150000'));
update t set v = (j ->> 'transaction_id')::uuid where k = 'food';
insert into t (k, j) values ('refund1', public.post_refund((select v from t where k = 'ws_a'), 'key-refund-1',
  (select v from t where k = 'food'), '50000'));
update t set v = (j ->> 'transaction_id')::uuid where k = 'refund1';
insert into t (k, j) values ('billpay', public.post_transfer((select v from t where k = 'ws_a'), 'key-billpay1',
  (select v from t where k = 'r_bca'), (select v from t where k = 'r_card'), '100000'));

select is((select balance from public.account_balances where id = (select v from t where k = 'r_bca')),
  '8400000', 'worked example: BCA balance');
select is((select balance from public.account_balances where id = (select v from t where k = 'r_card')),
  '0', 'worked example: card fully paid');
select is((select total from public.period_totals((select v from t where k = 'ws_a'), current_date - 1, current_date + 1)
           where category_id = (select v from t where k = 'cat_food')),
  '100000', 'refund reduces expense; bill payment adds none');
select is((select total from public.period_totals((select v from t where k = 'ws_a'), current_date - 1, current_date + 1)
           where category_id = (select v from t where k = 'cat_salary')),
  '8500000', 'income total');
select is((select j ->> 'amount' from t where k = 'salary'), '8500000', 'money leaves as a decimal string');
select is((select refunded_amount from public.transaction_feed where id = (select v from t where k = 'food')),
  '50000', 'feed shows the refunded amount');
select is((select category_id from public.transaction_feed where id = (select v from t where k = 'refund1')),
  (select v from t where k = 'cat_food'), 'a refund reports under its expense category');

-- Idempotency (R-03) ---------------------------------------------------------------
select is((public.post_expense((select v from t where k = 'ws_a'), 'key-food-001',
  (select v from t where k = 'r_card'), (select v from t where k = 'cat_food'), '150000') ->> 'replayed'),
  'true', 'same key and payload replays');
select is((public.post_expense((select v from t where k = 'ws_a'), 'key-food-001',
  (select v from t where k = 'r_card'), (select v from t where k = 'cat_food'), '0150000') ->> 'transaction_id')::uuid,
  (select v from t where k = 'food'), 'amount is normalized before fingerprinting');
select is((select count(*)::int from public.transactions where kind = 'expense'), 1, 'replay posted nothing new');
select throws_ok($$select public.post_expense((select v from t where k = 'ws_a'), 'key-food-001',
  (select v from t where k = 'r_card'), (select v from t where k = 'cat_food'), '999')$$,
  'P0001', 'IDEMPOTENCY_CONFLICT', 'same key with a different payload is rejected');
select throws_ok($$select public.post_expense((select v from t where k = 'ws_a'), 'short',
  (select v from t where k = 'r_card'), (select v from t where k = 'cat_food'), '1')$$,
  'P0001', 'VALIDATION_FAILED', 'too-short idempotency key is rejected');

-- Validation -------------------------------------------------------------------------
select throws_ok($$select public.post_expense((select v from t where k = 'ws_a'), 'key-val-0001',
  (select v from t where k = 'r_bca'), (select v from t where k = 'cat_food'), '1.5')$$,
  'P0001', 'VALIDATION_FAILED', 'fractional amount string is rejected');
select throws_ok($$select public.post_expense((select v from t where k = 'ws_a'), 'key-val-0002',
  (select v from t where k = 'r_bca'), (select v from t where k = 'cat_food'), '-5')$$,
  'P0001', 'VALIDATION_FAILED', 'negative expense is rejected');
select throws_ok($$select public.post_expense((select v from t where k = 'ws_a'), 'key-val-0003',
  (select v from t where k = 'r_bca'), (select v from t where k = 'cat_food'), '5', current_date + 2)$$,
  'P0001', 'VALIDATION_FAILED', 'future date is rejected (Q7)');
select throws_ok($$select public.post_expense((select v from t where k = 'ws_a'), 'key-val-0004',
  (select v from t where k = 'r_bca'), (select v from t where k = 'cat_salary'), '5')$$,
  'P0001', 'VALIDATION_FAILED', 'income category on an expense is rejected');
select throws_ok($$select public.post_income((select v from t where k = 'ws_a'), 'key-val-0005',
  (select v from t where k = 'r_card'), (select v from t where k = 'cat_salary'), '5')$$,
  'P0001', 'VALIDATION_FAILED', 'income onto a credit card is rejected');
select throws_ok($$select public.post_transfer((select v from t where k = 'ws_a'), 'key-val-0006',
  (select v from t where k = 'r_card'), (select v from t where k = 'r_bca'), '5')$$,
  'P0001', 'VALIDATION_FAILED', 'cash advance from a card is rejected (Q11)');
select throws_ok($$select public.post_transfer((select v from t where k = 'ws_a'), 'key-val-0007',
  (select v from t where k = 'r_bca'), (select v from t where k = 'r_bca'), '5')$$,
  'P0001', 'VALIDATION_FAILED', 'transfer to the same account is rejected');
select throws_ok($$select public.create_financial_account((select v from t where k = 'ws_a'), 'key-val-0008', 'bank', 'bca')$$,
  'P0001', 'VALIDATION_FAILED', 'duplicate account name (case-insensitive) is rejected');

select throws_ok($$select public.post_income((select v from t where k = 'ws_a'), 'key-null-001', null, (select v from t where k = 'cat_salary'), '5')$$,
  'P0001', 'VALIDATION_FAILED', 'a missing account is a validation error, not a raw one');
select throws_ok($$select public.post_refund((select v from t where k = 'ws_a'), 'key-null-002', null, '5')$$,
  'P0001', 'VALIDATION_FAILED', 'a missing refund parent is a validation error');
select throws_ok($$select public.create_financial_account((select v from t where k = 'ws_a'), 'key-null-003', null, 'X')$$,
  'P0001', 'VALIDATION_FAILED', 'a missing account kind is a validation error');
select throws_ok($$select public.post_expense((select v from t where k = 'ws_a'), 'key-big-0001', (select v from t where k = 'r_bca'), (select v from t where k = 'cat_food'), '1000000000000000')$$,
  'P0001', 'VALIDATION_FAILED', 'amounts above 15 digits are rejected');

-- Refund limits (D-15) ---------------------------------------------------------------
select throws_ok($$select public.post_refund((select v from t where k = 'ws_a'), 'key-ref-0002', (select v from t where k = 'food'), '100001')$$,
  'P0001', 'REFUND_EXCEEDS_ORIGINAL', 'refunds cannot exceed the original');
select lives_ok($$select public.reverse_transaction((select v from t where k = 'ws_a'), 'key-rev-ref1', (select v from t where k = 'refund1'), 'salah')$$,
  'a refund can be reversed');
select lives_ok($$select public.post_refund((select v from t where k = 'ws_a'), 'key-ref-0003', (select v from t where k = 'food'), '150000')$$,
  'a reversed refund frees its amount again');
select throws_ok($$select public.post_refund((select v from t where k = 'ws_a'), 'key-ref-0004', (select v from t where k = 'salary'), '1')$$,
  'P0001', 'VALIDATION_FAILED', 'income cannot be refunded');
select throws_ok($$select public.reverse_transaction((select v from t where k = 'ws_a'), 'key-rev-food', (select v from t where k = 'food'))$$,
  'P0001', 'HAS_DEPENDENT_REFUNDS', 'an expense with live refunds cannot be reversed');
select is((public.reverse_transaction((select v from t where k = 'ws_a'), 'key-rev-ref1', (select v from t where k = 'refund1'), 'salah') ->> 'replayed'),
  'true', 'retrying a reversal replays instead of failing');
select throws_ok($$select public.reverse_transaction((select v from t where k = 'ws_a'), 'key-rev-ref1', (select v from t where k = 'refund1'), 'alasan lain')$$,
  'P0001', 'IDEMPOTENCY_CONFLICT', 'reusing a key for another request is rejected');
select throws_ok($$select public.reverse_transaction((select v from t where k = 'ws_a'), 'key-rev-ref2', (select v from t where k = 'refund1'))$$,
  'P0001', 'POSTED_ENTRY_IMMUTABLE', 'a transaction is reversed only once');
select throws_ok($$select public.reverse_transaction((select v from t where k = 'ws_a'), 'key-rev-rev1',
  (select id from public.transactions where reverses_id = (select v from t where k = 'refund1')))$$,
  'P0001', 'VALIDATION_FAILED', 'a reversal cannot be reversed');

-- Edits (Q6) -------------------------------------------------------------------------
select lives_ok($$select public.edit_transaction((select v from t where k = 'ws_a'), 'key-edit-0001', (select v from t where k = 'food'),
  p_category_id => (select v from t where k = 'cat_transport'), p_note => 'makan siang')$$,
  'category and note can change even with refunds');
select is((select category_id from public.transactions where id = (select v from t where k = 'food')),
  (select v from t where k = 'cat_transport'), 'metadata edit updates in place');
select throws_ok($$select public.edit_transaction((select v from t where k = 'ws_a'), 'key-edit-0004', (select v from t where k = 'food'),
  p_income_source_id => gen_random_uuid())$$,
  'P0001', 'VALIDATION_FAILED', 'an income source only fits income');
select throws_ok($$select public.edit_transaction((select v from t where k = 'ws_a'), 'key-edit-0002', (select v from t where k = 'food'),
  p_amount => '160000')$$,
  'P0001', 'HAS_DEPENDENT_REFUNDS', 'amount cannot change while refunds depend on it');
insert into t (k, j) values ('edit_salary', public.edit_transaction((select v from t where k = 'ws_a'), 'key-edit-0003',
  (select v from t where k = 'salary'), p_amount => '9000000'));
select isnt((select (j ->> 'transaction_id')::uuid from t where k = 'edit_salary'), (select v from t where k = 'salary'),
  'amount edit reposts as a new transaction');
select ok((select (j ->> 'reversal_id') is not null from t where k = 'edit_salary'), 'amount edit returns the reversal id');
select is((select balance from public.account_balances where id = (select v from t where k = 'r_bca')),
  '8900000', 'balance follows the edited amount');
select is((select total from public.period_totals((select v from t where k = 'ws_a'), current_date - 1, current_date + 1)
           where category_id = (select v from t where k = 'cat_salary')),
  '9000000', 'income total counts only the edited amount');

-- Opening balances (Q13) and archive (D-14) ---------------------------------------
insert into t (k, j) values ('r_cash', public.create_financial_account((select v from t where k = 'ws_a'), 'key-cash-001', 'cash', 'Dompet', '-25000'));
update t set v = (j ->> 'financial_account_id')::uuid where k = 'r_cash';
select is((select balance from public.account_balances where id = (select v from t where k = 'r_cash')),
  '-25000', 'negative opening balance is allowed');
select throws_ok($$select public.set_financial_account_archived((select v from t where k = 'ws_a'), (select v from t where k = 'r_cash'), true)$$,
  'P0001', 'RESOURCE_HAS_BALANCE', 'an account with a balance cannot be archived');
select lives_ok($$select public.post_transfer((select v from t where k = 'ws_a'), 'key-cash-fix', (select v from t where k = 'r_bca'), (select v from t where k = 'r_cash'), '25000')$$,
  'zero the account');
select lives_ok($$select public.set_financial_account_archived((select v from t where k = 'ws_a'), (select v from t where k = 'r_cash'), true)$$,
  'a zero-balance account can be archived');
select throws_ok($$select public.post_expense((select v from t where k = 'ws_a'), 'key-arch-001', (select v from t where k = 'r_cash'), (select v from t where k = 'cat_food'), '1')$$,
  'P0001', 'RESOURCE_ARCHIVED', 'an archived account rejects postings');
select throws_ok($$select public.reverse_transaction((select v from t where k = 'ws_a'), 'key-arch-002',
  (select id from public.transactions where kind = 'transfer' and counter_account_id = (select v from t where k = 'r_cash')))$$,
  'P0001', 'RESOURCE_ARCHIVED', 'a reversal cannot move money into an archived account');
select lives_ok($$select public.set_financial_account_archived((select v from t where k = 'ws_a'), (select v from t where k = 'r_cash'), false)$$,
  'an archived account can be unarchived (Q9)');

-- Reconciliation (§8) ----------------------------------------------------------------
select is((select sum(case side when 'debit' then amount else -amount end)::bigint from public.journal_lines
           where workspace_id = (select v from t where k = 'ws_a')), 0::bigint, 'total debits equal total credits');
-- Net debit per class: asset balance = dr, liability balance = -dr, equity/income = -dr, expense = dr.
create temp table nd as
  select la.account_class as cls, sum(case when jl.side = 'debit' then jl.amount else -jl.amount end)::bigint as dr
    from public.journal_lines jl join public.ledger_accounts la on la.id = jl.ledger_account_id
   where jl.workspace_id = (select v from t where k = 'ws_a') group by la.account_class;
select is(
  (select coalesce(sum(dr) filter (where cls = 'asset'), 0) - coalesce(sum(-dr) filter (where cls = 'liability'), 0) from nd)::bigint,
  (select coalesce(sum(-dr) filter (where cls = 'equity'), 0) + coalesce(sum(-dr) filter (where cls = 'income'), 0)
        - coalesce(sum(dr) filter (where cls = 'expense'), 0) from nd)::bigint,
  'assets - liabilities = equity + income - expense');

-- Clients cannot write financial facts directly (D-11) --------------------------------
select throws_ok($$insert into public.transactions (workspace_id, kind, occurred_on, amount, currency, account_id, created_by)
  values ((select v from t where k = 'ws_a'), 'opening_balance', current_date, 1, 'IDR', (select v from t where k = 'r_bca'), auth.uid())$$,
  '42501', null, 'no direct insert into transactions');
select throws_ok($$update public.financial_accounts set archived_at = now() where id = (select v from t where k = 'r_bca')$$,
  '42501', null, 'archive state cannot be changed directly');
select lives_ok($$update public.financial_accounts set name = 'BCA Utama' where id = (select v from t where k = 'r_bca')$$,
  'account rename is allowed');
select lives_ok($$insert into public.transaction_categories (workspace_id, kind, name) values ((select v from t where k = 'ws_a'), 'expense', 'Kopi')$$,
  'categories can be added');
select throws_ok($$update public.transaction_categories set kind = 'income' where name = 'Kopi'$$,
  '42501', null, 'category kind cannot change');
select throws_ok($$select 1 from public.financial_commands$$, '42501', null, 'idempotency records are not readable');

-- As Citra (viewer): reads, but cannot post ------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}';
select isnt_empty($$select 1 from public.account_balances where workspace_id = (select v from t where k = 'ws_a')$$, 'viewer can read balances');
select throws_ok($$select public.post_expense((select v from t where k = 'ws_a'), 'key-viewer-1', (select v from t where k = 'r_bca'), (select v from t where k = 'cat_food'), '1')$$,
  'P0001', 'WORKSPACE_ACCESS_DENIED', 'viewer cannot post');
select is_empty($$select 1 from public.audit_logs$$, 'only the owner reads the audit log');

-- As Budi: isolation ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
select is_empty($$select 1 from public.transactions where workspace_id = (select v from t where k = 'ws_a')$$, 'Budi sees none of Ana''s transactions');
select is_empty($$select 1 from public.account_balances where workspace_id = (select v from t where k = 'ws_a')$$, 'Budi sees none of Ana''s balances');
select is_empty($$select 1 from public.transaction_feed where workspace_id = (select v from t where k = 'ws_a')$$, 'Budi sees none of Ana''s feed');
select is_empty($$select * from public.period_totals((select v from t where k = 'ws_a'), current_date - 1, current_date + 1)$$, 'Budi gets no totals for Ana');
select throws_ok($$select public.post_expense((select v from t where k = 'ws_a'), 'key-budi-001', (select v from t where k = 'r_bca'), (select v from t where k = 'cat_food'), '1')$$,
  'P0001', 'WORKSPACE_ACCESS_DENIED', 'Budi cannot post into Ana''s workspace');
select throws_ok($$select public.post_income((select v from t where k = 'ws_b'), 'key-budi-002', (select v from t where k = 'r_bca'),
  (select id from public.transaction_categories where workspace_id = (select v from t where k = 'ws_b') and name = 'Gaji'), '1')$$,
  'P0001', 'VALIDATION_FAILED', 'Budi cannot use Ana''s account from his own workspace');
select throws_ok($$select public.post_refund((select v from t where k = 'ws_b'), 'key-budi-003', (select v from t where k = 'food'), '1')$$,
  'P0001', 'VALIDATION_FAILED', 'Budi cannot refund Ana''s expense');

-- Anonymous callers -------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$select public.post_expense(null, 'key-anon-001', null, null, '1')$$, '42501', null, 'anon cannot call posting RPCs');
select throws_ok($$select * from public.account_balances$$, '42501', null, 'anon cannot read balances');

-- Database-level guards (as the table owner) ---------------------------------------------
reset role;
select throws_ok($$update public.journal_lines set amount = 1$$, 'P0001', 'POSTED_ENTRY_IMMUTABLE', 'journal lines are immutable');
select throws_ok($$delete from public.transactions where id = (select v from t where k = 'salary')$$, 'P0001', 'POSTED_ENTRY_IMMUTABLE', 'transactions cannot be deleted');
select throws_ok($$update public.transactions set amount = 1 where id = (select v from t where k = 'salary')$$, 'P0001', 'POSTED_ENTRY_IMMUTABLE', 'transaction amounts cannot change');
select throws_ok($$update public.workspaces set base_currency = 'USD' where id = (select v from t where k = 'ws_a')$$, 'P0001', 'VALIDATION_FAILED', 'base currency is fixed once the ledger exists');
select lives_ok($$set constraints all immediate$$, 'every posting so far balances');
select throws_ok($$
  with tx as (insert into public.transactions (workspace_id, kind, occurred_on, amount, currency, account_id, created_by)
              values ((select v from t where k = 'ws_a'), 'opening_balance', current_date, 1, 'IDR', (select v from t where k = 'r_bca'), 'aaaaaaaa-0000-0000-0000-000000000001') returning id)
  insert into public.journal_entries (workspace_id, transaction_id) select (select v from t where k = 'ws_a'), id from tx$$,
  'P0001', 'UNBALANCED_ENTRY', 'an entry without lines is caught');

select * from finish();
rollback;
