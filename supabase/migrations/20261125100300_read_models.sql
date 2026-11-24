-- G2a read models (docs/G2A_FINANCE_CORE_DRAFT_V1.md §8; D-13 SQL views).
-- security_invoker: every view runs under the caller's RLS. Money leaves as text (D-12).

-- Balance per financial account, in its normal direction (asset: debit - credit; card: amount owed).
create view public.account_balances with (security_invoker = true) as
select fa.id, fa.workspace_id, fa.kind, fa.name, fa.currency, fa.archived_at, fa.created_at,
       coalesce(sum(case when (jl.side = 'debit') = (la.account_class = 'asset') then jl.amount else -jl.amount end), 0)::text
         as balance
  from public.financial_accounts fa
  join public.ledger_accounts la on la.id = fa.ledger_account_id
  left join public.journal_lines jl on jl.ledger_account_id = la.id
 group by fa.id, la.account_class;

-- Transaction list. Refunds and reversals inherit category and accounts from what they point to,
-- so the list and the totals group them where they belong.
create view public.transaction_feed with (security_invoker = true) as
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
       end as refunded_amount
  from public.transactions t
  left join public.transactions p on p.id = coalesce(t.refund_of_id, t.reverses_id)
  left join public.transactions pp on pp.id = p.refund_of_id
  left join public.transaction_categories c on c.id = coalesce(t.category_id, p.category_id, pp.category_id)
  left join public.financial_accounts a on a.id = coalesce(t.account_id, p.account_id)
  left join public.financial_accounts ca on ca.id = coalesce(t.counter_account_id, p.counter_account_id)
  left join public.income_sources s on s.id = t.income_source_id;

-- Income and net expense per category for a date range. Refunds reduce expense; reversals cancel
-- what they reverse. Transfers and opening balances are not income or expense.
create function public.period_totals(p_workspace_id uuid, p_from date, p_to date)
returns table (category_id uuid, category_name text, kind text, total text)
language sql stable security invoker set search_path = '' as $$
  with rows as (
    select coalesce(t.category_id, p.category_id, pp.category_id) as cat,
           case
             when t.kind in ('income', 'expense') then t.amount
             when t.kind = 'refund' then -t.amount
             when t.kind = 'reversal' and p.kind in ('income', 'expense') then -t.amount
             when t.kind = 'reversal' and p.kind = 'refund' then t.amount
           end as value
      from public.transactions t
      left join public.transactions p on p.id = coalesce(t.refund_of_id, t.reverses_id)
      left join public.transactions pp on pp.id = p.refund_of_id
     where t.workspace_id = p_workspace_id and t.occurred_on between p_from and p_to
  )
  select c.id, c.name, c.kind, sum(r.value)::text
    from rows r join public.transaction_categories c on c.id = r.cat
   where r.value is not null
   group by c.id, c.name, c.kind
$$;

revoke all on public.account_balances, public.transaction_feed from public, anon, authenticated;
grant select on public.account_balances, public.transaction_feed to authenticated;
revoke execute on function public.period_totals(uuid, date, date) from public, anon;
grant execute on function public.period_totals(uuid, date, date) to authenticated;
