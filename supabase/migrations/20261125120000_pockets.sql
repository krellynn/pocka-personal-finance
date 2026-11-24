-- G3a pockets (docs/G3A_POCKETS_BUDGETS_DRAFT_V1.md, approved 2026-11-25; D-16, ADR-002).
-- Pockets are virtual allocations: no journal entries, no link to a financial account.
-- One immutable movement row per command: NULL side = "Belum dialokasikan" (Unallocated).

create table public.pockets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  name text not null check (char_length(name) between 1 and 60 and name = btrim(name)),
  currency char(3) not null references public.currencies (code),
  target_amount bigint check (target_amount > 0), -- Q4: display only, never enforced
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index pockets_active_name_idx on public.pockets (workspace_id, lower(name)) where archived_at is null;

create table public.pocket_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  from_pocket_id uuid,
  to_pocket_id uuid,
  amount bigint not null check (amount > 0),
  currency char(3) not null references public.currencies (code),
  note text check (note is null or char_length(note) <= 200),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  check (from_pocket_id is not null or to_pocket_id is not null),
  check (from_pocket_id is distinct from to_pocket_id),
  foreign key (workspace_id, from_pocket_id) references public.pockets (workspace_id, id),
  foreign key (workspace_id, to_pocket_id) references public.pockets (workspace_id, id)
);
create index pocket_movements_from_idx on public.pocket_movements (from_pocket_id) where from_pocket_id is not null;
create index pocket_movements_to_idx on public.pocket_movements (to_pocket_id) where to_pocket_id is not null;
create index pocket_movements_workspace_idx on public.pocket_movements (workspace_id, created_at desc);

create trigger pockets_no_delete before delete on public.pockets
  for each row execute function private.forbid_change();
create trigger pocket_movements_immutable before update or delete on public.pocket_movements
  for each row execute function private.forbid_change();

-- Helpers -----------------------------------------------------------------------------
-- Serializes pocket commands per workspace. Advisory, so postings (which never take it) are not blocked:
-- spending may create a shortfall (D-16). Never replace with FOR UPDATE on workspaces (FK inserts need KEY SHARE).
create function private.lock_pockets(p_workspace_id uuid) returns void
language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('pocka.pockets:' || p_workspace_id::text, 0));
$$;

-- D-16: active cash, bank and e-wallet balances; negatives reduce it; cards and archived accounts excluded.
-- Same formula as the pocket_summary view (a test checks they agree).
-- shortcut: re-sums all lines per allocation; add a balance cache only if profiling shows a need.
create function private.eligible_funds(p_workspace_id uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(ab.balance::bigint), 0)::bigint from public.account_balances ab
   where ab.workspace_id = p_workspace_id and ab.kind in ('cash', 'bank', 'ewallet') and ab.archived_at is null;
$$;

create function private.allocated_total(p_workspace_id uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(case when m.to_pocket_id is not null then m.amount else 0 end
                    - case when m.from_pocket_id is not null then m.amount else 0 end), 0)::bigint
    from public.pocket_movements m where m.workspace_id = p_workspace_id;
$$;

create function private.pocket_balance(p_pocket_id uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(case when m.to_pocket_id = p_pocket_id then m.amount else -m.amount end), 0)::bigint
    from public.pocket_movements m where m.to_pocket_id = p_pocket_id or m.from_pocket_id = p_pocket_id;
$$;

-- Requires the pocket to exist in the workspace and be active.
create function private.check_pocket(p_workspace_id uuid, p_pocket_id uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_archived timestamptz;
begin
  if p_pocket_id is null then perform private.fail('VALIDATION_FAILED', 'pocket'); end if;
  select archived_at into v_archived from public.pockets where workspace_id = p_workspace_id and id = p_pocket_id;
  if not found then perform private.fail('VALIDATION_FAILED', 'pocket'); end if;
  if v_archived is not null then perform private.fail('RESOURCE_ARCHIVED'); end if;
end $$;

-- The one writer of pocket_movements. Caller holds no pocket lock yet; balances are read after taking it.
create function private.do_pocket_move(p_ws uuid, p_actor uuid, p_from uuid, p_to uuid, p_amount bigint, p_note text)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_unallocated bigint;
begin
  perform private.lock_pockets(p_ws);
  if p_from is not null then perform private.check_pocket(p_ws, p_from); end if;
  if p_to is not null then perform private.check_pocket(p_ws, p_to); end if;
  if p_from is not null and private.pocket_balance(p_from) < p_amount then
    perform private.fail('POCKET_INSUFFICIENT');
  end if;
  -- Shortfall rule: only an allocation from Unallocated is checked, and it must leave Unallocated >= 0.
  if p_from is null and private.eligible_funds(p_ws) - private.allocated_total(p_ws) - p_amount < 0 then
    perform private.fail('ALLOCATION_EXCEEDS_ELIGIBLE');
  end if;
  insert into public.pocket_movements (workspace_id, from_pocket_id, to_pocket_id, amount, currency, note, created_by)
    values (p_ws, p_from, p_to, p_amount, (select base_currency from public.workspaces where id = p_ws), p_note, p_actor)
    returning id into v_id;
  perform private.audit(p_ws, p_actor, 'pocket_move', 'pocket_movement', v_id,
    jsonb_build_object('from', p_from, 'to', p_to, 'amount', p_amount::text));
  v_unallocated := private.eligible_funds(p_ws) - private.allocated_total(p_ws);
  return jsonb_build_object('movement_id', v_id, 'unallocated', v_unallocated::text);
end $$;

create function private.clean_pocket_note(p_note text) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(btrim(p_note), 200), '')
$$;

-- Public RPCs (D-11) -------------------------------------------------------------------
create function public.create_pocket(p_workspace_id uuid, p_idempotency_key text, p_name text, p_target_amount text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_name text := btrim(p_name);
  v_target bigint := case when nullif(btrim(coalesce(p_target_amount, '')), '') is null then null
                          else private.parse_amount(btrim(p_target_amount)) end;
  v_replay jsonb;
  v_id uuid;
begin
  if v_name is null or char_length(v_name) not between 1 and 60 then perform private.fail('VALIDATION_FAILED', 'pocket'); end if;
  -- G3a scope: IDR only (FX pockets wait for D-18/D-19). Movements inherit the pocket's workspace currency.
  if (select base_currency from public.workspaces where id = p_workspace_id) <> 'IDR' then
    perform private.fail('CURRENCY_NOT_SUPPORTED');
  end if;
  v_replay := private.claim_command(p_workspace_id, 'create_pocket', p_idempotency_key, v_actor,
    jsonb_build_object('name', v_name, 'target', v_target::text));
  if v_replay is not null then return v_replay; end if;
  begin
    insert into public.pockets (workspace_id, name, currency, target_amount)
      values (p_workspace_id, v_name, (select base_currency from public.workspaces where id = p_workspace_id), v_target)
      returning id into v_id;
  exception when unique_violation then
    perform private.fail('VALIDATION_FAILED', 'name taken');
  end;
  perform private.audit(p_workspace_id, v_actor, 'create_pocket', 'pocket', v_id);
  return private.finish_command(p_workspace_id, 'create_pocket', p_idempotency_key, jsonb_build_object('pocket_id', v_id));
end $$;

-- Naturally idempotent (absolute target state), so no key, like set_financial_account_archived.
create function public.set_pocket_archived(p_workspace_id uuid, p_pocket_id uuid, p_archived boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_archived_at timestamptz;
begin
  perform private.lock_pockets(p_workspace_id);
  select archived_at into v_archived_at from public.pockets
   where workspace_id = p_workspace_id and id = p_pocket_id for update;
  if not found or p_archived is null then perform private.fail('VALIDATION_FAILED', 'pocket'); end if;
  if p_archived and v_archived_at is null then
    -- Q3: archive only when empty, so no allocation silently disappears.
    if private.pocket_balance(p_pocket_id) <> 0 then perform private.fail('RESOURCE_HAS_BALANCE'); end if;
    update public.pockets set archived_at = now(), updated_at = now() where id = p_pocket_id;
    perform private.audit(p_workspace_id, v_actor, 'archive_pocket', 'pocket', p_pocket_id);
  elsif not p_archived and v_archived_at is not null then
    begin
      update public.pockets set archived_at = null, updated_at = now() where id = p_pocket_id;
    exception when unique_violation then
      perform private.fail('VALIDATION_FAILED', 'name taken');
    end;
    perform private.audit(p_workspace_id, v_actor, 'unarchive_pocket', 'pocket', p_pocket_id);
  end if;
  return jsonb_build_object('pocket_id', p_pocket_id, 'archived', p_archived);
end $$;

create function public.allocate_to_pocket(p_workspace_id uuid, p_idempotency_key text, p_pocket_id uuid, p_amount text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_amount bigint := private.parse_amount(p_amount);
  v_note text := private.clean_pocket_note(p_note);
  v_replay jsonb;
begin
  if p_pocket_id is null then perform private.fail('VALIDATION_FAILED', 'pocket'); end if;
  v_replay := private.claim_command(p_workspace_id, 'allocate_to_pocket', p_idempotency_key, v_actor,
    jsonb_build_object('to', p_pocket_id, 'amount', v_amount::text, 'note', v_note));
  if v_replay is not null then return v_replay; end if;
  return private.finish_command(p_workspace_id, 'allocate_to_pocket', p_idempotency_key,
    private.do_pocket_move(p_workspace_id, v_actor, null, p_pocket_id, v_amount, v_note));
end $$;

create function public.deallocate_from_pocket(p_workspace_id uuid, p_idempotency_key text, p_pocket_id uuid, p_amount text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_amount bigint := private.parse_amount(p_amount);
  v_note text := private.clean_pocket_note(p_note);
  v_replay jsonb;
begin
  if p_pocket_id is null then perform private.fail('VALIDATION_FAILED', 'pocket'); end if;
  v_replay := private.claim_command(p_workspace_id, 'deallocate_from_pocket', p_idempotency_key, v_actor,
    jsonb_build_object('from', p_pocket_id, 'amount', v_amount::text, 'note', v_note));
  if v_replay is not null then return v_replay; end if;
  return private.finish_command(p_workspace_id, 'deallocate_from_pocket', p_idempotency_key,
    private.do_pocket_move(p_workspace_id, v_actor, p_pocket_id, null, v_amount, v_note));
end $$;

create function public.move_between_pockets(p_workspace_id uuid, p_idempotency_key text, p_from_pocket_id uuid, p_to_pocket_id uuid,
  p_amount text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_amount bigint := private.parse_amount(p_amount);
  v_note text := private.clean_pocket_note(p_note);
  v_replay jsonb;
begin
  if p_from_pocket_id is null or p_to_pocket_id is null or p_from_pocket_id = p_to_pocket_id then
    perform private.fail('VALIDATION_FAILED', 'pocket');
  end if;
  v_replay := private.claim_command(p_workspace_id, 'move_between_pockets', p_idempotency_key, v_actor,
    jsonb_build_object('from', p_from_pocket_id, 'to', p_to_pocket_id, 'amount', v_amount::text, 'note', v_note));
  if v_replay is not null then return v_replay; end if;
  return private.finish_command(p_workspace_id, 'move_between_pockets', p_idempotency_key,
    private.do_pocket_move(p_workspace_id, v_actor, p_from_pocket_id, p_to_pocket_id, v_amount, v_note));
end $$;

-- Read models (D-13; security_invoker so each reader's RLS applies; money as text, D-12) ----------
create view public.pocket_balances with (security_invoker = true) as
select p.id, p.workspace_id, p.name, p.currency, p.target_amount::text as target_amount, p.archived_at, p.created_at,
       coalesce(sum(case when m.to_pocket_id = p.id then m.amount else -m.amount end), 0)::text as balance
  from public.pockets p
  left join public.pocket_movements m on m.to_pocket_id = p.id or m.from_pocket_id = p.id
 group by p.id;

create view public.pocket_summary with (security_invoker = true) as
select w.id as workspace_id, s.eligible::text as eligible_funds, s.allocated::text as allocated,
       (s.eligible - s.allocated)::text as unallocated, s.eligible - s.allocated < 0 as is_shortfall
  from public.workspaces w
 cross join lateral (
   select (select coalesce(sum(ab.balance::bigint), 0) from public.account_balances ab
            where ab.workspace_id = w.id and ab.kind in ('cash', 'bank', 'ewallet') and ab.archived_at is null) as eligible,
          (select coalesce(sum(case when m.to_pocket_id is not null then m.amount else 0 end
                             - case when m.from_pocket_id is not null then m.amount else 0 end), 0)
             from public.pocket_movements m where m.workspace_id = w.id) as allocated
 ) s;

-- RLS and grants ------------------------------------------------------------------------
alter table public.pockets enable row level security;
alter table public.pocket_movements enable row level security;

create policy "pockets: members read" on public.pockets for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = pockets.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "pocket_movements: members read" on public.pocket_movements for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = pocket_movements.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "pockets: writers rename" on public.pockets for update to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = pockets.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = pockets.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));

revoke all on public.pockets, public.pocket_movements, public.pocket_balances, public.pocket_summary from public, anon, authenticated;
grant select, update (name) on public.pockets to authenticated;
grant select on public.pocket_movements, public.pocket_balances, public.pocket_summary to authenticated;

revoke all on function private.lock_pockets(uuid), private.eligible_funds(uuid), private.allocated_total(uuid),
  private.pocket_balance(uuid), private.check_pocket(uuid, uuid), private.do_pocket_move(uuid, uuid, uuid, uuid, bigint, text),
  private.clean_pocket_note(text) from public, anon, authenticated;
revoke all on function public.create_pocket(uuid, text, text, text), public.set_pocket_archived(uuid, uuid, boolean),
  public.allocate_to_pocket(uuid, text, uuid, text, text), public.deallocate_from_pocket(uuid, text, uuid, text, text),
  public.move_between_pockets(uuid, text, uuid, uuid, text, text) from public, anon;
grant execute on function public.create_pocket(uuid, text, text, text), public.set_pocket_archived(uuid, uuid, boolean),
  public.allocate_to_pocket(uuid, text, uuid, text, text), public.deallocate_from_pocket(uuid, text, uuid, text, text),
  public.move_between_pockets(uuid, text, uuid, uuid, text, text) to authenticated;
