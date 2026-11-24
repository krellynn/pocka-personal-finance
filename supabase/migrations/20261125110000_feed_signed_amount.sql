-- G2a UI follow-up (docs/G2A_UI_PLAN_V1.md, known limits): transaction_feed gains signed_amount so the UI can
-- edit an opening balance without losing its sign (Q13 allows negative ones). Every other kind keeps amount.
-- The sign follows account_balances: positive grows the account's balance (asset: money in, card: amount owed).
-- Columns are only appended, so existing readers are unaffected; grants and security_invoker carry over.
create or replace view public.transaction_feed with (security_invoker = true) as
select t.id, t.workspace_id, t.kind, t.occurred_on, t.amount::text as amount, t.currency, t.note, t.created_at,
       t.refund_of_id, t.reverses_id,
       coalesce(t.account_id, p.account_id) as account_id, a.name as account_name,
       coalesce(t.counter_account_id, p.counter_account_id) as counter_account_id, ca.name as counter_account_name,
       c.id as category_id, c.name as category_name, c.kind as category_kind,
       t.income_source_id, s.name as income_source_name,
       exists (select 1 from public.transactions r where r.reverses_id = t.id) as is_reversed,
       case when t.kind = 'expense' then (
         select coalesce(sum(r.amount), 0) from public.transactions r
          where r.refund_of_id = t.id
            and not exists (select 1 from public.transactions x where x.reverses_id = r.id))::text
       end as refunded_amount,
       case when t.kind = 'opening_balance' then (
         select case when (jl.side = 'debit') = (la.account_class = 'asset') then t.amount else -t.amount end
           from public.journal_entries je
           join public.journal_lines jl on jl.journal_entry_id = je.id
           join public.ledger_accounts la on la.id = jl.ledger_account_id
          where je.transaction_id = t.id and la.id = a.ledger_account_id)::text
       else t.amount::text end as signed_amount
  from public.transactions t
  left join public.transactions p on p.id = coalesce(t.refund_of_id, t.reverses_id)
  left join public.transactions pp on pp.id = p.refund_of_id
  left join public.transaction_categories c on c.id = coalesce(t.category_id, p.category_id, pp.category_id)
  left join public.financial_accounts a on a.id = coalesce(t.account_id, p.account_id)
  left join public.financial_accounts ca on ca.id = coalesce(t.counter_account_id, p.counter_account_id)
  left join public.income_sources s on s.id = t.income_source_id;
