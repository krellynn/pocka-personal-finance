-- G2a ledger core (docs/G2A_FINANCE_CORE_DRAFT_V1.md §2, §4, §7).
-- Tables, integrity triggers, RLS and grants. Financial writes happen only through the
-- posting RPCs in the next migration (D-11); clients get SELECT plus a few non-financial columns.

-- Ledger accounts ------------------------------------------------------------
create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  account_class text not null check (account_class in ('asset', 'liability', 'equity', 'income', 'expense')),
  system_code text check (system_code in ('OPENING_BALANCE_EQUITY', 'INCOME', 'EXPENSE')),
  currency char(3) not null references public.currencies (code),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, id, currency),
  unique (workspace_id, system_code)
);

-- Financial accounts (user-facing; one ledger account each) ------------------
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  ledger_account_id uuid not null unique,
  kind text not null check (kind in ('cash', 'bank', 'ewallet', 'credit_card')),
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  currency char(3) not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, ledger_account_id, currency)
    references public.ledger_accounts (workspace_id, id, currency)
);
create unique index financial_accounts_active_name_idx
  on public.financial_accounts (workspace_id, lower(name)) where archived_at is null;

-- Classification dimensions (D-09) -------------------------------------------
create table public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  kind text not null check (kind in ('income', 'expense')),
  name text not null check (char_length(name) between 1 and 60 and name = btrim(name)),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index transaction_categories_active_name_idx
  on public.transaction_categories (workspace_id, kind, lower(name)) where archived_at is null;

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  name text not null check (char_length(name) between 1 and 60 and name = btrim(name)),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index income_sources_active_name_idx
  on public.income_sources (workspace_id, lower(name)) where archived_at is null;

create trigger financial_accounts_set_updated_at before update on public.financial_accounts
  for each row execute function private.set_updated_at();
create trigger transaction_categories_set_updated_at before update on public.transaction_categories
  for each row execute function private.set_updated_at();
create trigger income_sources_set_updated_at before update on public.income_sources
  for each row execute function private.set_updated_at();

-- Transactions (business-event header) ----------------------------------------
-- Every reference is a composite (workspace_id, id) FK: rows can never point across workspaces.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  kind text not null check (kind in ('opening_balance', 'income', 'expense', 'transfer', 'refund', 'reversal')),
  occurred_on date not null,
  amount bigint not null check (amount > 0),
  currency char(3) not null references public.currencies (code),
  category_id uuid,
  income_source_id uuid,
  account_id uuid,
  counter_account_id uuid,
  refund_of_id uuid,
  reverses_id uuid unique,
  note text check (char_length(note) <= 500),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, category_id) references public.transaction_categories (workspace_id, id),
  foreign key (workspace_id, income_source_id) references public.income_sources (workspace_id, id),
  foreign key (workspace_id, account_id) references public.financial_accounts (workspace_id, id),
  foreign key (workspace_id, counter_account_id) references public.financial_accounts (workspace_id, id),
  foreign key (workspace_id, refund_of_id) references public.transactions (workspace_id, id),
  foreign key (workspace_id, reverses_id) references public.transactions (workspace_id, id),
  constraint transactions_kind_shape_check check (case kind
    when 'opening_balance' then account_id is not null and category_id is null and income_source_id is null
      and counter_account_id is null and refund_of_id is null and reverses_id is null
    when 'income' then account_id is not null and category_id is not null
      and counter_account_id is null and refund_of_id is null and reverses_id is null
    when 'expense' then account_id is not null and category_id is not null and income_source_id is null
      and counter_account_id is null and refund_of_id is null and reverses_id is null
    when 'transfer' then account_id is not null and counter_account_id is not null and counter_account_id <> account_id
      and category_id is null and income_source_id is null and refund_of_id is null and reverses_id is null
    when 'refund' then account_id is not null and refund_of_id is not null and category_id is null
      and income_source_id is null and counter_account_id is null and reverses_id is null
    when 'reversal' then reverses_id is not null and account_id is null and category_id is null
      and income_source_id is null and counter_account_id is null and refund_of_id is null
  end)
);
create index transactions_workspace_date_idx on public.transactions (workspace_id, occurred_on desc, created_at desc);
create index transactions_refund_of_idx on public.transactions (refund_of_id) where refund_of_id is not null;
create index transactions_account_idx on public.transactions (account_id);
create index transactions_counter_account_idx on public.transactions (counter_account_id);

-- Journal ----------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  transaction_id uuid not null unique, -- G2a: exactly one entry per transaction
  posted_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, transaction_id) references public.transactions (workspace_id, id)
);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  journal_entry_id uuid not null,
  ledger_account_id uuid not null,
  currency char(3) not null,
  side text not null check (side in ('debit', 'credit')),
  amount bigint not null check (amount > 0),
  base_amount bigint not null check (base_amount > 0),
  foreign key (workspace_id, journal_entry_id) references public.journal_entries (workspace_id, id),
  foreign key (workspace_id, ledger_account_id, currency) references public.ledger_accounts (workspace_id, id, currency)
);
create index journal_lines_entry_idx on public.journal_lines (journal_entry_id);
create index journal_lines_ledger_idx on public.journal_lines (ledger_account_id);

-- Idempotency (R-03) and audit -------------------------------------------------
create table public.financial_commands (
  workspace_id uuid not null references public.workspaces (id),
  operation text not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  request_fingerprint text not null,
  actor uuid not null references auth.users (id),
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (workspace_id, operation, idempotency_key)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  actor uuid references auth.users (id),
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_workspace_idx on public.audit_logs (workspace_id, created_at desc);

-- Integrity triggers -------------------------------------------------------------
-- Posted facts are immutable. On transactions only the classification dimensions
-- (category, income source, note) may change: they are metadata, not ledger facts (D-09).
create function private.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'POSTED_ENTRY_IMMUTABLE' using errcode = 'P0001';
end $$;

create function private.transactions_guard_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - array['category_id', 'income_source_id', 'note'])
     is distinct from (to_jsonb(old) - array['category_id', 'income_source_id', 'note']) then
    raise exception 'POSTED_ENTRY_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger transactions_no_delete before delete on public.transactions
  for each row execute function private.forbid_change();
create trigger transactions_guard_update before update on public.transactions
  for each row execute function private.transactions_guard_update();
create trigger journal_entries_immutable before update or delete on public.journal_entries
  for each row execute function private.forbid_change();
create trigger journal_lines_immutable before update or delete on public.journal_lines
  for each row execute function private.forbid_change();
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.forbid_change();
create trigger ledger_accounts_no_delete before delete on public.ledger_accounts
  for each row execute function private.forbid_change();
create trigger financial_accounts_no_delete before delete on public.financial_accounts
  for each row execute function private.forbid_change();

-- A reversal mirrors its original exactly and is never itself reversed (R-10).
create function private.check_reversal() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_original public.transactions;
begin
  select * into v_original from public.transactions where id = new.reverses_id;
  if v_original.kind = 'reversal' or v_original.amount <> new.amount or v_original.currency <> new.currency then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'invalid reversal';
  end if;
  return new;
end $$;
create trigger transactions_check_reversal before insert on public.transactions
  for each row when (new.kind = 'reversal') execute function private.check_reversal();

-- Checked at commit: every entry has >= 2 lines and balances; every transaction has its entry.
create function private.check_entry_balanced() returns trigger
language plpgsql set search_path = '' as $$
declare
  -- Shared by both tables: a line row carries journal_entry_id, an entry row is the entry itself.
  v_entry uuid := coalesce((to_jsonb(new) ->> 'journal_entry_id')::uuid, new.id);
  v_lines int;
  v_net bigint;
begin
  select count(*), coalesce(sum(case side when 'debit' then base_amount else -base_amount end), 0)
    into v_lines, v_net
    from public.journal_lines where journal_entry_id = v_entry;
  if v_lines < 2 or v_net <> 0 then
    raise exception 'UNBALANCED_ENTRY' using errcode = 'P0001', detail = v_entry::text;
  end if;
  return null;
end $$;
create constraint trigger journal_entries_balanced after insert on public.journal_entries
  deferrable initially deferred for each row execute function private.check_entry_balanced();
create constraint trigger journal_lines_balanced after insert on public.journal_lines
  deferrable initially deferred for each row execute function private.check_entry_balanced();

create function private.check_transaction_has_entry() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.journal_entries where transaction_id = new.id) then
    raise exception 'UNBALANCED_ENTRY' using errcode = 'P0001', detail = 'transaction without entry';
  end if;
  return null;
end $$;
create constraint trigger transactions_have_entry after insert on public.transactions
  deferrable initially deferred for each row execute function private.check_transaction_has_entry();

-- G2a is single-currency: the base currency is fixed once the ledger exists.
create function private.lock_base_currency() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.base_currency is distinct from old.base_currency
     and exists (select 1 from public.ledger_accounts where workspace_id = new.id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'base currency is fixed once the ledger exists';
  end if;
  return new;
end $$;
create trigger workspaces_lock_base_currency before update on public.workspaces
  for each row execute function private.lock_base_currency();

-- Provisioning: system ledger accounts and default categories (G2a §2, Q4) ------
-- Replaces the Phase 0B version; same idempotent contract, plus the G2a rows.
create or replace function private.provision_user(p_user_id uuid, p_email text, p_meta jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(coalesce(
    nullif(btrim(p_meta ->> 'display_name'), ''),
    nullif(btrim(p_meta ->> 'full_name'), ''),
    nullif(btrim(p_meta ->> 'name'), ''),
    nullif(btrim(split_part(p_email, '@', 1)), ''),
    'Pengguna'), 80);
  v_workspace_id uuid;
begin
  insert into public.profiles (id, display_name)
    values (p_user_id, v_name)
    on conflict (id) do nothing;

  insert into public.workspaces (workspace_type, name, personal_owner_id, created_by)
    values ('personal', 'Pribadi', p_user_id, p_user_id)
    on conflict (personal_owner_id) do nothing;

  select id into strict v_workspace_id
    from public.workspaces where personal_owner_id = p_user_id;

  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
    values (v_workspace_id, p_user_id, 'owner', 'active', now())
    on conflict (workspace_id, user_id) do nothing;

  insert into public.user_settings (user_id, default_workspace_id)
    values (p_user_id, v_workspace_id)
    on conflict (user_id) do nothing;

  perform private.provision_ledger(v_workspace_id);
  return v_workspace_id;
end $$;

create function private.provision_ledger(p_workspace_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ledger_accounts (workspace_id, account_class, system_code, currency)
    select p_workspace_id, s.class, s.code, w.base_currency
      from public.workspaces w,
           (values ('equity', 'OPENING_BALANCE_EQUITY'), ('income', 'INCOME'), ('expense', 'EXPENSE')) as s(class, code)
     where w.id = p_workspace_id
    on conflict (workspace_id, system_code) do nothing;

  -- Default categories only for a workspace that has none yet, so a rerun never duplicates them.
  if not exists (select 1 from public.transaction_categories where workspace_id = p_workspace_id) then
    insert into public.transaction_categories (workspace_id, kind, name)
      select p_workspace_id, c.kind, c.name
        from (values
          ('expense', 'Makan & Minum'), ('expense', 'Transportasi'), ('expense', 'Belanja'),
          ('expense', 'Tagihan'), ('expense', 'Kesehatan'), ('expense', 'Hiburan'),
          ('expense', 'Pendidikan'), ('expense', 'Lainnya'),
          ('income', 'Gaji'), ('income', 'Usaha'), ('income', 'Hadiah'), ('income', 'Lainnya')
        ) as c(kind, name);
  end if;
end $$;
revoke all on function private.provision_ledger(uuid) from public, anon, authenticated;
revoke all on function private.provision_user(uuid, text, jsonb) from public, anon, authenticated;

-- Backfill existing personal workspaces (idempotent).
select private.provision_ledger(id) from public.workspaces where workspace_type = 'personal';

-- Row-level security ------------------------------------------------------------
alter table public.ledger_accounts enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.income_sources enable row level security;
alter table public.transactions enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.financial_commands enable row level security;
alter table public.audit_logs enable row level security;

-- Read: active members of the row's workspace (same inline pattern as the identity migration).
create policy "ledger_accounts: members read" on public.ledger_accounts for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = ledger_accounts.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "financial_accounts: members read" on public.financial_accounts for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = financial_accounts.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "transaction_categories: members read" on public.transaction_categories for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = transaction_categories.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "income_sources: members read" on public.income_sources for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = income_sources.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "transactions: members read" on public.transactions for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = transactions.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "journal_entries: members read" on public.journal_entries for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = journal_entries.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "journal_lines: members read" on public.journal_lines for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = journal_lines.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "audit_logs: owner reads" on public.audit_logs for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = audit_logs.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));

-- Non-financial writes: writer roles (owner/admin/editor) on their workspace.
create policy "financial_accounts: writers rename" on public.financial_accounts for update to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = financial_accounts.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = financial_accounts.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));
create policy "transaction_categories: writers insert" on public.transaction_categories for insert to authenticated
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = transaction_categories.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));
create policy "transaction_categories: writers update" on public.transaction_categories for update to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = transaction_categories.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = transaction_categories.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));
create policy "income_sources: writers insert" on public.income_sources for insert to authenticated
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = income_sources.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));
create policy "income_sources: writers update" on public.income_sources for update to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = income_sources.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = income_sources.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));

-- Grants: deny by default, then column-scoped. RLS cannot restrict columns; grants do.
revoke all on public.ledger_accounts, public.financial_accounts, public.transaction_categories,
  public.income_sources, public.transactions, public.journal_entries, public.journal_lines,
  public.financial_commands, public.audit_logs from public, anon, authenticated;
grant select on public.ledger_accounts, public.transactions, public.journal_entries,
  public.journal_lines, public.audit_logs to authenticated;
grant select, update (name) on public.financial_accounts to authenticated;
grant select, insert (workspace_id, kind, name), update (name, archived_at) on public.transaction_categories to authenticated;
grant select, insert (workspace_id, name), update (name, archived_at) on public.income_sources to authenticated;
