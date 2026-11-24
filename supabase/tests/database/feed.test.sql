-- transaction_feed.signed_amount: opening balances keep their sign; other kinds equal amount.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'feed-ana@test.local', '{}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'feed-budi@test.local', '{}', 'authenticated', 'authenticated');
create temp table t (k text primary key, v uuid);
grant all on t to authenticated;
insert into t values ('ws', (select id from public.workspaces where personal_owner_id = 'bbbbbbbb-0000-0000-0000-000000000001'));
insert into t select 'food', id from public.transaction_categories where workspace_id = (select v from t where k = 'ws') and name = 'Makan & Minum';

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
insert into t select 'over', (public.create_financial_account((select v from t where k = 'ws'), 'feed-key-001', 'bank', 'Minus', '-25000') ->> 'financial_account_id')::uuid;
insert into t select 'plus', (public.create_financial_account((select v from t where k = 'ws'), 'feed-key-002', 'cash', 'Plus', '40000') ->> 'financial_account_id')::uuid;
insert into t select 'card', (public.create_financial_account((select v from t where k = 'ws'), 'feed-key-003', 'credit_card', 'Kartu', '300000') ->> 'financial_account_id')::uuid;
select public.post_expense((select v from t where k = 'ws'), 'feed-key-004', (select v from t where k = 'plus'), (select v from t where k = 'food'), '1500');

select is((select signed_amount from public.transaction_feed where account_id = (select v from t where k = 'over') and kind = 'opening_balance'),
  '-25000', 'negative asset opening balance is signed');
select is((select signed_amount from public.transaction_feed where account_id = (select v from t where k = 'plus') and kind = 'opening_balance'),
  '40000', 'positive asset opening balance is signed');
select is((select signed_amount from public.transaction_feed where account_id = (select v from t where k = 'card') and kind = 'opening_balance'),
  (select balance from public.account_balances where id = (select v from t where k = 'card')), 'card opening balance matches the amount owed');
select is((select signed_amount from public.transaction_feed where kind = 'expense'), '1500', 'other kinds: signed_amount = amount');

-- Editing a negative opening balance with the signed value keeps the sign.
select public.edit_transaction((select v from t where k = 'ws'), 'feed-key-005',
  (select id from public.transaction_feed where account_id = (select v from t where k = 'over') and kind = 'opening_balance' and not is_reversed),
  p_amount => '-30000');
select is((select balance from public.account_balances where id = (select v from t where k = 'over')), '-30000', 'signed edit keeps the balance negative');

-- Another user still sees nothing (security_invoker survives the replace).
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.transaction_feed where workspace_id = (select v from t where k = 'ws')), 0, 'feed stays isolated per user');

select * from finish();
rollback;
