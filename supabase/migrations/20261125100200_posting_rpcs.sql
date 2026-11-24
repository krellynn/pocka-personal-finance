-- G2a posting RPCs (docs/G2A_FINANCE_CORE_DRAFT_V1.md §3, §5, §6).
-- Public functions are thin wrappers: authorize, claim the idempotency key, call a private
-- worker, store the result. Workers assume the caller already holds the row locks they need.
-- Errors are raised with the stable code as the message (errcode P0001); clients map codes to copy.

-- Helpers -------------------------------------------------------------------------
create function private.fail(p_code text, p_detail text default null) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception '%', p_code using errcode = 'P0001', detail = coalesce(p_detail, '');
end $$;

-- Actor must be an active owner/admin/editor of the workspace. Unknown workspaces look the same
-- as forbidden ones, so nothing is revealed about other users' workspaces.
create function private.require_writer(p_workspace_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then perform private.fail('AUTH_REQUIRED'); end if;
  if not exists (select 1 from public.workspace_members m
                 where m.workspace_id = p_workspace_id and m.user_id = v_actor and m.status = 'active'
                   and m.role in ('owner', 'admin', 'editor')) then
    perform private.fail('WORKSPACE_ACCESS_DENIED');
  end if;
  return v_actor;
end $$;

-- Decimal-integer money string (D-12) to bigint. 15 digits keeps any realistic sum inside bigint.
create function private.parse_amount(p_text text, p_allow_negative boolean default false) returns bigint
language plpgsql immutable set search_path = '' as $$
declare
  v bigint;
begin
  if p_text is null or p_text !~ '^-?[0-9]{1,15}$' then perform private.fail('VALIDATION_FAILED', 'amount'); end if;
  v := p_text::bigint;
  if v = 0 or (v < 0 and not p_allow_negative) then perform private.fail('VALIDATION_FAILED', 'amount'); end if;
  return v;
end $$;

-- Business date in the workspace timezone; no future dates (Q7).
create function private.check_date(p_workspace_id uuid, p_date date) returns date
language plpgsql stable set search_path = '' as $$
declare
  v_today date;
begin
  select (now() at time zone w.timezone)::date into v_today from public.workspaces w where w.id = p_workspace_id;
  if p_date is null then return v_today; end if;
  if p_date > v_today then perform private.fail('VALIDATION_FAILED', 'date in the future'); end if;
  return p_date;
end $$;

create function private.clean_note(p_note text) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(btrim(p_note), 500), '')
$$;

-- Idempotency (R-03). Returns the stored result (marked replayed) or null for a fresh claim.
-- Under READ COMMITTED a concurrent duplicate blocks on the primary key until the first commits.
create function private.claim_command(p_workspace_id uuid, p_operation text, p_key text, p_actor uuid, p_canonical jsonb)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_fingerprint text := encode(sha256(convert_to(p_canonical::text || '|' || p_actor::text, 'UTF8')), 'hex');
  v_row public.financial_commands;
  v_count int;
begin
  if p_key is null or char_length(p_key) not between 8 and 200 then perform private.fail('VALIDATION_FAILED', 'idempotency key'); end if;
  insert into public.financial_commands (workspace_id, operation, idempotency_key, request_fingerprint, actor)
    values (p_workspace_id, p_operation, p_key, v_fingerprint, p_actor)
    on conflict do nothing;
  get diagnostics v_count = row_count;
  if v_count = 1 then return null; end if;

  select * into v_row from public.financial_commands
   where workspace_id = p_workspace_id and operation = p_operation and idempotency_key = p_key;
  if v_row.request_fingerprint <> v_fingerprint or v_row.result is null then
    perform private.fail('IDEMPOTENCY_CONFLICT');
  end if;
  return v_row.result || jsonb_build_object('replayed', true);
end $$;

create function private.finish_command(p_workspace_id uuid, p_operation text, p_key text, p_result jsonb)
returns jsonb
language sql set search_path = '' as $$
  update public.financial_commands set result = p_result
   where workspace_id = p_workspace_id and operation = p_operation and idempotency_key = p_key;
  select p_result || jsonb_build_object('replayed', false);
$$;

create function private.audit(p_workspace_id uuid, p_actor uuid, p_action text, p_entity text, p_id uuid, p_details jsonb default '{}')
returns void
language sql set search_path = '' as $$
  insert into public.audit_logs (workspace_id, actor, action, entity, entity_id, details)
  values (p_workspace_id, p_actor, p_action, p_entity, p_id, p_details);
$$;

-- Lock order (§6): transaction rows first, then financial accounts, each by ascending id.
-- Locks the given accounts and requires them to exist in the workspace and be active.
create function private.lock_accounts(p_workspace_id uuid, p_ids uuid[]) returns void
language plpgsql set search_path = '' as $$
declare
  v_wanted int := (select count(distinct x) from unnest(p_ids) x where x is not null);
  v_found int := 0;
  v_archived int := 0;
  r record;
begin
  if array_position(p_ids, null) is not null then perform private.fail('VALIDATION_FAILED', 'account'); end if;
  for r in select fa.archived_at from public.financial_accounts fa
            where fa.workspace_id = p_workspace_id and fa.id = any(p_ids)
            order by fa.id for update loop
    v_found := v_found + 1;
    if r.archived_at is not null then v_archived := v_archived + 1; end if;
  end loop;
  if v_found <> v_wanted then perform private.fail('VALIDATION_FAILED', 'account'); end if;
  if v_archived > 0 then perform private.fail('RESOURCE_ARCHIVED'); end if;
end $$;

-- Transaction rows in the workspace, locked by ascending id; unknown ids fail without revealing anything.
create function private.lock_transactions(p_workspace_id uuid, p_ids uuid[]) returns void
language plpgsql set search_path = '' as $$
declare
  v_wanted int := (select count(distinct x) from unnest(p_ids) x where x is not null);
  v_found int;
begin
  if array_position(p_ids, null) is not null then perform private.fail('VALIDATION_FAILED', 'transaction'); end if;
  with locked as (select t.id from public.transactions t
                   where t.workspace_id = p_workspace_id and t.id = any(p_ids) order by t.id for update)
  select count(*) into v_found from locked;
  if v_found <> v_wanted then perform private.fail('VALIDATION_FAILED', 'transaction'); end if;
end $$;

create function private.system_ledger(p_workspace_id uuid, p_code text) returns uuid
language sql stable set search_path = '' as $$
  select id from public.ledger_accounts where workspace_id = p_workspace_id and system_code = p_code
$$;

create function private.is_reversed(p_transaction_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.transactions where reverses_id = p_transaction_id)
$$;

create function private.refunded_amount(p_expense_id uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(r.amount), 0)::bigint from public.transactions r
   where r.refund_of_id = p_expense_id and not private.is_reversed(r.id)
$$;

-- Balance in the account's normal direction (asset: debit - credit, liability: credit - debit).
create function private.account_balance(p_account_id uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(case when (jl.side = 'debit') = (la.account_class = 'asset') then jl.amount else -jl.amount end), 0)::bigint
    from public.financial_accounts fa
    join public.ledger_accounts la on la.id = fa.ledger_account_id
    left join public.journal_lines jl on jl.ledger_account_id = la.id
   where fa.id = p_account_id
$$;

-- Writes the header, one entry and a debit/credit line pair. Returns (transaction_id, entry_id).
create function private.write_posting(
  p_workspace_id uuid, p_actor uuid, p_kind text, p_occurred_on date, p_amount bigint,
  p_debit_ledger uuid, p_credit_ledger uuid,
  p_account_id uuid default null, p_counter_account_id uuid default null, p_category_id uuid default null,
  p_income_source_id uuid default null, p_refund_of_id uuid default null, p_reverses_id uuid default null,
  p_note text default null)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_currency char(3);
  v_tx uuid;
  v_entry uuid;
begin
  select base_currency into v_currency from public.workspaces where id = p_workspace_id;
  insert into public.transactions (workspace_id, kind, occurred_on, amount, currency, category_id, income_source_id,
                                   account_id, counter_account_id, refund_of_id, reverses_id, note, created_by)
    values (p_workspace_id, p_kind, p_occurred_on, p_amount, v_currency, p_category_id, p_income_source_id,
            p_account_id, p_counter_account_id, p_refund_of_id, p_reverses_id, p_note, p_actor)
    returning id into v_tx;
  insert into public.journal_entries (workspace_id, transaction_id) values (p_workspace_id, v_tx) returning id into v_entry;
  insert into public.journal_lines (workspace_id, journal_entry_id, ledger_account_id, currency, side, amount, base_amount)
    values (p_workspace_id, v_entry, p_debit_ledger, v_currency, 'debit', p_amount, p_amount),
           (p_workspace_id, v_entry, p_credit_ledger, v_currency, 'credit', p_amount, p_amount);
  perform private.audit(p_workspace_id, p_actor, 'post_' || p_kind, 'transaction', v_tx);
  return jsonb_build_object('transaction_id', v_tx, 'journal_entry_id', v_entry, 'status', 'posted',
                            'amount', p_amount::text);
end $$;

create function private.check_category(p_workspace_id uuid, p_category_id uuid, p_kind text) returns void
language plpgsql set search_path = '' as $$
declare
  v_kind text; v_archived timestamptz;
begin
  select kind, archived_at into v_kind, v_archived from public.transaction_categories
   where workspace_id = p_workspace_id and id = p_category_id;
  if v_kind is distinct from p_kind then perform private.fail('VALIDATION_FAILED', 'category'); end if;
  if v_archived is not null then perform private.fail('RESOURCE_ARCHIVED'); end if;
end $$;

create function private.check_income_source(p_workspace_id uuid, p_source_id uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_found boolean; v_archived timestamptz;
begin
  if p_source_id is null then return; end if;
  select true, archived_at into v_found, v_archived from public.income_sources
   where workspace_id = p_workspace_id and id = p_source_id;
  if v_found is null then perform private.fail('VALIDATION_FAILED', 'income source'); end if;
  if v_archived is not null then perform private.fail('RESOURCE_ARCHIVED'); end if;
end $$;

-- Workers (locks already held) ----------------------------------------------------
create function private.do_opening(p_ws uuid, p_actor uuid, p_account_id uuid, p_signed bigint, p_on date, p_note text)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_ledger uuid; v_class text; v_debit_account boolean;
begin
  select fa.ledger_account_id, la.account_class into v_ledger, v_class
    from public.financial_accounts fa join public.ledger_accounts la on la.id = fa.ledger_account_id
   where fa.id = p_account_id;
  -- Asset with a positive balance, or a card in credit, debits the account (§3, Q13).
  v_debit_account := (v_class = 'asset') = (p_signed > 0);
  return private.write_posting(p_ws, p_actor, 'opening_balance', p_on, abs(p_signed),
    case when v_debit_account then v_ledger else private.system_ledger(p_ws, 'OPENING_BALANCE_EQUITY') end,
    case when v_debit_account then private.system_ledger(p_ws, 'OPENING_BALANCE_EQUITY') else v_ledger end,
    p_account_id => p_account_id, p_note => p_note);
end $$;

create function private.do_income(p_ws uuid, p_actor uuid, p_account_id uuid, p_category_id uuid, p_source_id uuid,
                                  p_amount bigint, p_on date, p_note text)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_ledger uuid; v_kind text;
begin
  select ledger_account_id, kind into v_ledger, v_kind from public.financial_accounts where id = p_account_id;
  if v_kind = 'credit_card' then perform private.fail('VALIDATION_FAILED', 'income needs an asset account'); end if;
  perform private.check_category(p_ws, p_category_id, 'income');
  perform private.check_income_source(p_ws, p_source_id);
  return private.write_posting(p_ws, p_actor, 'income', p_on, p_amount, v_ledger, private.system_ledger(p_ws, 'INCOME'),
    p_account_id => p_account_id, p_category_id => p_category_id, p_income_source_id => p_source_id, p_note => p_note);
end $$;

-- Asset account: spend. Credit card: purchase (credits the liability). Same lines either way (Q2).
create function private.do_expense(p_ws uuid, p_actor uuid, p_account_id uuid, p_category_id uuid,
                                   p_amount bigint, p_on date, p_note text)
returns jsonb
language plpgsql set search_path = '' as $$
begin
  perform private.check_category(p_ws, p_category_id, 'expense');
  return private.write_posting(p_ws, p_actor, 'expense', p_on, p_amount, private.system_ledger(p_ws, 'EXPENSE'),
    (select ledger_account_id from public.financial_accounts where id = p_account_id),
    p_account_id => p_account_id, p_category_id => p_category_id, p_note => p_note);
end $$;

-- Asset to asset, or asset to card (bill payment, Q2). Card to anything is a cash advance (Q11, deferred).
create function private.do_transfer(p_ws uuid, p_actor uuid, p_from uuid, p_to uuid, p_amount bigint, p_on date, p_note text)
returns jsonb
language plpgsql set search_path = '' as $$
begin
  if p_from = p_to then perform private.fail('VALIDATION_FAILED', 'same account'); end if;
  if (select kind from public.financial_accounts where id = p_from) = 'credit_card' then
    perform private.fail('VALIDATION_FAILED', 'cash advance is not supported yet');
  end if;
  return private.write_posting(p_ws, p_actor, 'transfer', p_on, p_amount,
    (select ledger_account_id from public.financial_accounts where id = p_to),
    (select ledger_account_id from public.financial_accounts where id = p_from),
    p_account_id => p_from, p_counter_account_id => p_to, p_note => p_note);
end $$;

-- D-15: the original is a posted, unreversed expense; unreversed refunds + this one <= original.
create function private.do_refund(p_ws uuid, p_actor uuid, p_refund_of uuid, p_account_id uuid, p_amount bigint,
                                  p_on date, p_note text)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_original public.transactions;
begin
  select * into v_original from public.transactions where id = p_refund_of;
  if v_original.kind <> 'expense' or private.is_reversed(v_original.id) then
    perform private.fail('VALIDATION_FAILED', 'only an unreversed expense can be refunded');
  end if;
  if private.refunded_amount(v_original.id) + p_amount > v_original.amount then
    perform private.fail('REFUND_EXCEEDS_ORIGINAL');
  end if;
  return private.write_posting(p_ws, p_actor, 'refund', p_on, p_amount,
    (select ledger_account_id from public.financial_accounts where id = p_account_id),
    private.system_ledger(p_ws, 'EXPENSE'),
    p_account_id => p_account_id, p_refund_of_id => p_refund_of, p_note => p_note);
end $$;

-- Mirrors the original's lines, dated like the original so period totals cancel out.
create function private.do_reverse(p_ws uuid, p_actor uuid, p_transaction_id uuid, p_reason text)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_original public.transactions;
  v_debit uuid; v_credit uuid;
  v_result jsonb;
begin
  select * into v_original from public.transactions where id = p_transaction_id;
  if v_original.kind = 'reversal' then perform private.fail('VALIDATION_FAILED', 'a reversal cannot be reversed'); end if;
  if private.is_reversed(v_original.id) then perform private.fail('POSTED_ENTRY_IMMUTABLE'); end if;
  if v_original.kind = 'expense' and private.refunded_amount(v_original.id) > 0 then
    perform private.fail('HAS_DEPENDENT_REFUNDS');
  end if;
  select max(jl.ledger_account_id::text) filter (where jl.side = 'credit')::uuid,
         max(jl.ledger_account_id::text) filter (where jl.side = 'debit')::uuid
    into v_debit, v_credit
    from public.journal_lines jl join public.journal_entries je on je.id = jl.journal_entry_id
   where je.transaction_id = v_original.id;
  v_result := private.write_posting(p_ws, p_actor, 'reversal', v_original.occurred_on, v_original.amount,
    v_debit, v_credit, p_reverses_id => v_original.id);
  perform private.audit(p_ws, p_actor, 'reverse', 'transaction', v_original.id,
    jsonb_build_object('reason', nullif(left(btrim(coalesce(p_reason, '')), 200), '')));
  return v_result;
end $$;

-- Every account the transaction touched (a reversal may not move money into an archived account, D-14).
create function private.touched_accounts(p_transaction_id uuid) returns uuid[]
language sql stable set search_path = '' as $$
  select array_remove(array[account_id, counter_account_id], null) from public.transactions where id = p_transaction_id
$$;

-- Transaction rows to lock for a reversal or edit: the parent expense first when the target is a refund.
create function private.lock_for_change(p_ws uuid, p_transaction_id uuid) returns public.transactions
language plpgsql set search_path = '' as $$
declare
  v_target public.transactions;
  v_parent uuid;
begin
  select refund_of_id into v_parent from public.transactions where workspace_id = p_ws and id = p_transaction_id;
  -- Both rows are locked in ascending id order, as the global lock order requires.
  perform private.lock_transactions(p_ws, array_remove(array[p_transaction_id, v_parent], null));
  select * into v_target from public.transactions where id = p_transaction_id;
  return v_target;
end $$;

-- Public RPCs -----------------------------------------------------------------------
create function public.create_financial_account(
  p_workspace_id uuid, p_idempotency_key text, p_kind text, p_name text,
  p_opening_balance text default '0', p_opened_on date default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_name text := btrim(p_name);
  v_balance bigint;
  v_on date := private.check_date(p_workspace_id, p_opened_on);
  v_replay jsonb;
  v_currency char(3);
  v_ledger uuid;
  v_account uuid;
  v_result jsonb;
begin
  if p_kind is null or p_kind not in ('cash', 'bank', 'ewallet', 'credit_card') or v_name is null or char_length(v_name) not between 1 and 80 then
    perform private.fail('VALIDATION_FAILED', 'account');
  end if;
  v_balance := case when coalesce(p_opening_balance, '0') ~ '^-?0+$' then 0
                    else private.parse_amount(p_opening_balance, true) end;
  v_replay := private.claim_command(p_workspace_id, 'create_financial_account', p_idempotency_key, v_actor,
    jsonb_build_object('kind', p_kind, 'name', v_name, 'balance', v_balance::text, 'on', p_opened_on));
  if v_replay is not null then return v_replay; end if;

  select base_currency into v_currency from public.workspaces where id = p_workspace_id;
  insert into public.ledger_accounts (workspace_id, account_class, currency)
    values (p_workspace_id, case p_kind when 'credit_card' then 'liability' else 'asset' end, v_currency)
    returning id into v_ledger;
  begin
    insert into public.financial_accounts (workspace_id, ledger_account_id, kind, name, currency)
      values (p_workspace_id, v_ledger, p_kind, v_name, v_currency)
      returning id into v_account;
  exception when unique_violation then
    perform private.fail('VALIDATION_FAILED', 'name taken');
  end;
  perform private.audit(p_workspace_id, v_actor, 'create_account', 'financial_account', v_account);

  v_result := jsonb_build_object('financial_account_id', v_account);
  if v_balance <> 0 then
    v_result := v_result || private.do_opening(p_workspace_id, v_actor, v_account, v_balance, v_on, null);
  end if;
  return private.finish_command(p_workspace_id, 'create_financial_account', p_idempotency_key, v_result);
end $$;

-- Archive only at zero balance (D-14); unarchive is always safe (Q9). Naturally idempotent.
create function public.set_financial_account_archived(p_workspace_id uuid, p_account_id uuid, p_archived boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_archived_at timestamptz;
begin
  select archived_at into v_archived_at from public.financial_accounts
   where workspace_id = p_workspace_id and id = p_account_id for update;
  if not found then perform private.fail('VALIDATION_FAILED', 'account'); end if;
  if p_archived and v_archived_at is null then
    if private.account_balance(p_account_id) <> 0 then perform private.fail('RESOURCE_HAS_BALANCE'); end if;
    update public.financial_accounts set archived_at = now() where id = p_account_id;
    perform private.audit(p_workspace_id, v_actor, 'archive_account', 'financial_account', p_account_id);
  elsif not p_archived and v_archived_at is not null then
    begin
      update public.financial_accounts set archived_at = null where id = p_account_id;
    exception when unique_violation then
      perform private.fail('VALIDATION_FAILED', 'name taken');
    end;
    perform private.audit(p_workspace_id, v_actor, 'unarchive_account', 'financial_account', p_account_id);
  end if;
  return jsonb_build_object('financial_account_id', p_account_id, 'archived', p_archived);
end $$;

create function public.post_income(
  p_workspace_id uuid, p_idempotency_key text, p_account_id uuid, p_category_id uuid, p_amount text,
  p_occurred_on date default null, p_income_source_id uuid default null, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_amount bigint := private.parse_amount(p_amount);
  v_on date := private.check_date(p_workspace_id, p_occurred_on);
  v_note text := private.clean_note(p_note);
  v_replay jsonb;
begin
  v_replay := private.claim_command(p_workspace_id, 'post_income', p_idempotency_key, v_actor,
    jsonb_build_object('account', p_account_id, 'category', p_category_id, 'source', p_income_source_id,
                       'amount', v_amount::text, 'on', p_occurred_on, 'note', v_note));
  if v_replay is not null then return v_replay; end if;
  perform private.lock_accounts(p_workspace_id, array[p_account_id]);
  return private.finish_command(p_workspace_id, 'post_income', p_idempotency_key,
    private.do_income(p_workspace_id, v_actor, p_account_id, p_category_id, p_income_source_id, v_amount, v_on, v_note));
end $$;

create function public.post_expense(
  p_workspace_id uuid, p_idempotency_key text, p_account_id uuid, p_category_id uuid, p_amount text,
  p_occurred_on date default null, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_amount bigint := private.parse_amount(p_amount);
  v_on date := private.check_date(p_workspace_id, p_occurred_on);
  v_note text := private.clean_note(p_note);
  v_replay jsonb;
begin
  v_replay := private.claim_command(p_workspace_id, 'post_expense', p_idempotency_key, v_actor,
    jsonb_build_object('account', p_account_id, 'category', p_category_id, 'amount', v_amount::text, 'on', p_occurred_on, 'note', v_note));
  if v_replay is not null then return v_replay; end if;
  perform private.lock_accounts(p_workspace_id, array[p_account_id]);
  return private.finish_command(p_workspace_id, 'post_expense', p_idempotency_key,
    private.do_expense(p_workspace_id, v_actor, p_account_id, p_category_id, v_amount, v_on, v_note));
end $$;

create function public.post_transfer(
  p_workspace_id uuid, p_idempotency_key text, p_from_account_id uuid, p_to_account_id uuid, p_amount text,
  p_occurred_on date default null, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_amount bigint := private.parse_amount(p_amount);
  v_on date := private.check_date(p_workspace_id, p_occurred_on);
  v_note text := private.clean_note(p_note);
  v_replay jsonb;
begin
  v_replay := private.claim_command(p_workspace_id, 'post_transfer', p_idempotency_key, v_actor,
    jsonb_build_object('from', p_from_account_id, 'to', p_to_account_id, 'amount', v_amount::text, 'on', p_occurred_on, 'note', v_note));
  if v_replay is not null then return v_replay; end if;
  perform private.lock_accounts(p_workspace_id, array[p_from_account_id, p_to_account_id]);
  return private.finish_command(p_workspace_id, 'post_transfer', p_idempotency_key,
    private.do_transfer(p_workspace_id, v_actor, p_from_account_id, p_to_account_id, v_amount, v_on, v_note));
end $$;

create function public.post_refund(
  p_workspace_id uuid, p_idempotency_key text, p_refund_of_id uuid, p_amount text,
  p_account_id uuid default null, p_occurred_on date default null, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_amount bigint := private.parse_amount(p_amount);
  v_on date := private.check_date(p_workspace_id, p_occurred_on);
  v_note text := private.clean_note(p_note);
  v_account uuid;
  v_replay jsonb;
begin
  v_replay := private.claim_command(p_workspace_id, 'post_refund', p_idempotency_key, v_actor,
    jsonb_build_object('of', p_refund_of_id, 'account', p_account_id, 'amount', v_amount::text, 'on', p_occurred_on, 'note', v_note));
  if v_replay is not null then return v_replay; end if;
  perform private.lock_transactions(p_workspace_id, array[p_refund_of_id]);
  -- Defaults to the original's account (Q12).
  v_account := coalesce(p_account_id, (select account_id from public.transactions where id = p_refund_of_id));
  perform private.lock_accounts(p_workspace_id, array[v_account]);
  return private.finish_command(p_workspace_id, 'post_refund', p_idempotency_key,
    private.do_refund(p_workspace_id, v_actor, p_refund_of_id, v_account, v_amount, v_on, v_note));
end $$;

create function public.reverse_transaction(
  p_workspace_id uuid, p_idempotency_key text, p_transaction_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_replay jsonb;
begin
  v_replay := private.claim_command(p_workspace_id, 'reverse_transaction', p_idempotency_key, v_actor,
    jsonb_build_object('transaction', p_transaction_id, 'reason', nullif(left(btrim(coalesce(p_reason, '')), 200), '')));
  if v_replay is not null then return v_replay; end if;
  perform private.lock_for_change(p_workspace_id, p_transaction_id);
  perform private.lock_accounts(p_workspace_id, private.touched_accounts(p_transaction_id));
  return private.finish_command(p_workspace_id, 'reverse_transaction', p_idempotency_key,
    private.do_reverse(p_workspace_id, v_actor, p_transaction_id, p_reason));
end $$;

-- Edit (Q6). Changing only category, income source or note updates those dimensions in place
-- (they are metadata, not ledger facts, D-09). Anything else reverses and reposts in one command.
-- Null parameters keep the current value; an empty note clears it.
create function public.edit_transaction(
  p_workspace_id uuid, p_idempotency_key text, p_transaction_id uuid,
  p_amount text default null, p_occurred_on date default null, p_account_id uuid default null,
  p_counter_account_id uuid default null, p_category_id uuid default null,
  p_income_source_id uuid default null, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_old public.transactions;
  v_class text;
  v_old_signed bigint;
  v_amount bigint;
  v_on date;
  v_account uuid;
  v_counter uuid;
  v_category uuid;
  v_source uuid;
  v_note text;
  v_reversal jsonb;
  v_new jsonb;
  v_replay jsonb;
begin
  v_replay := private.claim_command(p_workspace_id, 'edit_transaction', p_idempotency_key, v_actor,
    jsonb_build_object('transaction', p_transaction_id, 'amount', p_amount, 'on', p_occurred_on, 'account', p_account_id,
      'counter', p_counter_account_id, 'category', p_category_id, 'source', p_income_source_id, 'note', p_note));
  if v_replay is not null then return v_replay; end if;

  v_old := private.lock_for_change(p_workspace_id, p_transaction_id);
  if v_old.kind = 'reversal' then perform private.fail('VALIDATION_FAILED', 'a reversal cannot be edited'); end if;
  if private.is_reversed(v_old.id) then perform private.fail('POSTED_ENTRY_IMMUTABLE'); end if;

  -- Opening balances are signed (Q13): recover the old sign from the account's line.
  if v_old.kind = 'opening_balance' then
    select la.account_class, case when (jl.side = 'debit') = (la.account_class = 'asset') then v_old.amount else -v_old.amount end
      into v_class, v_old_signed
      from public.journal_entries je
      join public.journal_lines jl on jl.journal_entry_id = je.id
      join public.financial_accounts fa on fa.ledger_account_id = jl.ledger_account_id
      join public.ledger_accounts la on la.id = fa.ledger_account_id
     where je.transaction_id = v_old.id;
    v_amount := case when p_amount is null then v_old_signed else private.parse_amount(p_amount, true) end;
  else
    v_amount := case when p_amount is null then v_old.amount else private.parse_amount(p_amount) end;
  end if;
  v_on := case when p_occurred_on is null then v_old.occurred_on else private.check_date(p_workspace_id, p_occurred_on) end;
  v_account := coalesce(p_account_id, v_old.account_id);
  v_counter := coalesce(p_counter_account_id, v_old.counter_account_id);
  v_category := coalesce(p_category_id, v_old.category_id);
  v_source := case when p_income_source_id is null then v_old.income_source_id else p_income_source_id end;
  v_note := case when p_note is null then v_old.note else private.clean_note(p_note) end;

  if v_amount = coalesce(v_old_signed, v_old.amount) and v_on = v_old.occurred_on
     and v_account is not distinct from v_old.account_id and v_counter is not distinct from v_old.counter_account_id then
    -- Metadata-only edit: allowed even when refunds depend on the expense.
    if v_category is distinct from v_old.category_id then
      perform private.check_category(p_workspace_id, v_category, v_old.kind);
    end if;
    if v_source is not null and v_old.kind <> 'income' then perform private.fail('VALIDATION_FAILED', 'income source'); end if;
    if v_source is distinct from v_old.income_source_id then
      perform private.check_income_source(p_workspace_id, v_source);
    end if;
    update public.transactions set category_id = v_category, income_source_id = v_source, note = v_note
     where id = v_old.id;
    perform private.audit(p_workspace_id, v_actor, 'edit_details', 'transaction', v_old.id);
    return private.finish_command(p_workspace_id, 'edit_transaction', p_idempotency_key,
      jsonb_build_object('transaction_id', v_old.id, 'reversal_id', null, 'status', 'posted'));
  end if;

  -- Financial change: lock the union of old and new accounts up front, in id order.
  perform private.lock_accounts(p_workspace_id,
    array_remove(array[v_old.account_id, v_old.counter_account_id, v_account, v_counter], null));
  v_reversal := private.do_reverse(p_workspace_id, v_actor, v_old.id, 'edit');
  v_new := case v_old.kind
    when 'opening_balance' then private.do_opening(p_workspace_id, v_actor, v_account, v_amount, v_on, v_note)
    when 'income' then private.do_income(p_workspace_id, v_actor, v_account, v_category, v_source, v_amount, v_on, v_note)
    when 'expense' then private.do_expense(p_workspace_id, v_actor, v_account, v_category, v_amount, v_on, v_note)
    when 'transfer' then private.do_transfer(p_workspace_id, v_actor, v_account, v_counter, v_amount, v_on, v_note)
    when 'refund' then private.do_refund(p_workspace_id, v_actor, v_old.refund_of_id, v_account, v_amount, v_on, v_note)
  end;
  return private.finish_command(p_workspace_id, 'edit_transaction', p_idempotency_key,
    v_new || jsonb_build_object('reversal_id', v_reversal ->> 'transaction_id'));
end $$;

-- Grants: Postgres gives EXECUTE to PUBLIC by default and Supabase adds anon; take both away.
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function
  public.create_financial_account(uuid, text, text, text, text, date),
  public.set_financial_account_archived(uuid, uuid, boolean),
  public.post_income(uuid, text, uuid, uuid, text, date, uuid, text),
  public.post_expense(uuid, text, uuid, uuid, text, date, text),
  public.post_transfer(uuid, text, uuid, uuid, text, date, text),
  public.post_refund(uuid, text, uuid, text, uuid, date, text),
  public.reverse_transaction(uuid, text, uuid, text),
  public.edit_transaction(uuid, text, uuid, text, date, uuid, uuid, uuid, uuid, text)
  from public, anon;
grant execute on function
  public.create_financial_account(uuid, text, text, text, text, date),
  public.set_financial_account_archived(uuid, uuid, boolean),
  public.post_income(uuid, text, uuid, uuid, text, date, uuid, text),
  public.post_expense(uuid, text, uuid, uuid, text, date, text),
  public.post_transfer(uuid, text, uuid, uuid, text, date, text),
  public.post_refund(uuid, text, uuid, text, uuid, date, text),
  public.reverse_transaction(uuid, text, uuid, text),
  public.edit_transaction(uuid, text, uuid, text, date, uuid, uuid, uuid, uuid, text)
  to authenticated;
