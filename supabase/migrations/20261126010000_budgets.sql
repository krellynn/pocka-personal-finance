-- G3a budgets (docs/G3A_POCKETS_BUDGETS_DRAFT_V1.md §2-§6): monthly planned amount per expense category,
-- budget vs actual, audited plan changes. Writes are RPC-only; clients read through RLS.
create table public.budgets (
  workspace_id uuid not null references public.workspaces (id),
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  category_id uuid not null,
  planned_amount bigint not null check (planned_amount > 0),
  currency char(3) not null references public.currencies (code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, period_month, category_id),
  foreign key (workspace_id, category_id) references public.transaction_categories (workspace_id, id)
);
create index budgets_category_idx on public.budgets (category_id);

-- Serializes budget writes per workspace so the audited old value is exact. Postings never take it.
create function private.lock_budgets(p_workspace_id uuid) returns void
language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('pocka.budgets:' || p_workspace_id::text, 0));
$$;

create function private.check_month(p_month date) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_month is null or p_month <> date_trunc('month', p_month)::date then perform private.fail('VALIDATION_FAILED', 'month'); end if;
end $$;

-- Naturally idempotent (absolute target state), so no key; last writer wins, the audit log is the record.
-- "0" removes the plan; removal is allowed even for a since-archived category (only new or changed plans are blocked).
create function public.set_budget(p_workspace_id uuid, p_month date, p_category_id uuid, p_amount text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_new bigint := case when btrim(coalesce(p_amount, '')) ~ '^0+$' then 0 else private.parse_amount(btrim(p_amount)) end;
  v_old bigint;
begin
  perform private.check_month(p_month);
  if (select base_currency from public.workspaces where id = p_workspace_id) <> 'IDR' then
    perform private.fail('CURRENCY_NOT_SUPPORTED');
  end if;
  if v_new > 0 then perform private.check_category(p_workspace_id, p_category_id, 'expense'); end if;
  perform private.lock_budgets(p_workspace_id);
  select planned_amount into v_old from public.budgets
   where workspace_id = p_workspace_id and period_month = p_month and category_id = p_category_id;
  if v_old is not distinct from nullif(v_new, 0) then
    return jsonb_build_object('category_id', p_category_id, 'month', p_month, 'planned', v_new::text);
  end if;
  if v_new = 0 then
    delete from public.budgets where workspace_id = p_workspace_id and period_month = p_month and category_id = p_category_id;
  else
    insert into public.budgets (workspace_id, period_month, category_id, planned_amount, currency)
      values (p_workspace_id, p_month, p_category_id, v_new, 'IDR')
      on conflict (workspace_id, period_month, category_id)
      do update set planned_amount = excluded.planned_amount, updated_at = now();
  end if;
  perform private.audit(p_workspace_id, v_actor, 'set_budget', 'budget', p_category_id,
    jsonb_build_object('month', p_month, 'old', v_old::text, 'new', nullif(v_new, 0)::text));
  return jsonb_build_object('category_id', p_category_id, 'month', p_month, 'planned', v_new::text);
end $$;

-- Q8: no rollover. Copies only categories missing in the target month and skips archived ones; a rerun copies nothing.
create function public.copy_budgets(p_workspace_id uuid, p_from_month date, p_to_month date)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_count int := 0;
  r record;
begin
  perform private.check_month(p_from_month);
  perform private.check_month(p_to_month);
  if p_from_month = p_to_month then perform private.fail('VALIDATION_FAILED', 'month'); end if;
  if (select base_currency from public.workspaces where id = p_workspace_id) <> 'IDR' then
    perform private.fail('CURRENCY_NOT_SUPPORTED');
  end if;
  perform private.lock_budgets(p_workspace_id);
  for r in
    insert into public.budgets (workspace_id, period_month, category_id, planned_amount, currency)
    select b.workspace_id, p_to_month, b.category_id, b.planned_amount, b.currency
      from public.budgets b join public.transaction_categories c on c.id = b.category_id
     where b.workspace_id = p_workspace_id and b.period_month = p_from_month
       and c.archived_at is null and c.kind = 'expense'
    on conflict (workspace_id, period_month, category_id) do nothing
    returning category_id, planned_amount
  loop
    v_count := v_count + 1;
    perform private.audit(p_workspace_id, v_actor, 'copy_budget', 'budget', r.category_id,
      jsonb_build_object('from', p_from_month, 'month', p_to_month, 'old', null, 'new', r.planned_amount::text));
  end loop;
  return jsonb_build_object('copied', v_count, 'month', p_to_month);
end $$;

-- Read model: budgets full-joined with the month's expense rows of period_totals. Spending without a plan comes back
-- with has_budget = false (shown as "Tanpa anggaran"), so sum(actual) reconciles with period_totals. Money as text (D-12).
create function public.budget_vs_actual(p_workspace_id uuid, p_month date)
returns table (category_id uuid, category_name text, category_archived boolean, has_budget boolean,
               planned text, actual text, remaining text, is_over boolean)
language sql stable security invoker set search_path = '' as $$
  -- Any date in the month means that month, so the plan and the spending window always match.
  with mo as (select date_trunc('month', p_month)::date as d),
  b as (
    select bu.category_id, bu.planned_amount from public.budgets bu
     where bu.workspace_id = p_workspace_id and bu.period_month = (select d from mo)
  ), a as (
    select pt.category_id, pt.total::bigint as actual
      from mo, public.period_totals(p_workspace_id, mo.d, (mo.d + interval '1 month' - interval '1 day')::date) pt
     where pt.kind = 'expense'
  )
  select c.id, c.name, c.archived_at is not null, b.category_id is not null,
         b.planned_amount::text, coalesce(a.actual, 0)::text,
         (b.planned_amount - coalesce(a.actual, 0))::text,
         b.category_id is not null and coalesce(a.actual, 0) > b.planned_amount
    from b full join a on a.category_id = b.category_id
    join public.transaction_categories c on c.id = coalesce(b.category_id, a.category_id)
   order by b.category_id is null, c.name
$$;

-- RLS and grants ------------------------------------------------------------------------
alter table public.budgets enable row level security;
create policy "budgets: members read" on public.budgets for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = budgets.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active'));

revoke all on public.budgets from public, anon, authenticated;
grant select on public.budgets to authenticated;
revoke all on function private.lock_budgets(uuid), private.check_month(date) from public, anon, authenticated;
revoke all on function public.set_budget(uuid, date, uuid, text), public.copy_budgets(uuid, date, date),
  public.budget_vs_actual(uuid, date) from public, anon;
grant execute on function public.set_budget(uuid, date, uuid, text), public.copy_budgets(uuid, date, date),
  public.budget_vs_actual(uuid, date) to authenticated;
