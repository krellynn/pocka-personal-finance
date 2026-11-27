-- G3b goals (docs/G3B_GOALS_DRAFT_V1.md §1-§8): savings targets with an optional link to one pocket.
-- Writes are RPC-only and audited; clients read through RLS. Progress is virtual (D-16): the linked pocket's balance.
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  name text not null check (char_length(name) between 1 and 60 and name = btrim(name)),
  target_amount bigint not null check (target_amount > 0),
  currency char(3) not null references public.currencies (code),
  target_date date check (target_date <= date '2100-12-31'),
  notes text check (char_length(notes) <= 500),
  pocket_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, pocket_id) references public.pockets (workspace_id, id)
);
create index goals_workspace_idx on public.goals (workspace_id);
create unique index goals_active_name_idx on public.goals (workspace_id, lower(name)) where archived_at is null;
create unique index goals_active_pocket_idx on public.goals (pocket_id) where pocket_id is not null and archived_at is null;

create trigger goals_no_delete before delete on public.goals
  for each row execute function private.forbid_change();
create trigger goals_set_updated_at before update on public.goals
  for each row execute function private.set_updated_at();

-- Helpers -----------------------------------------------------------------------------
-- Caller holds private.lock_pockets, which serializes every goal write and every pocket archive per workspace.
-- Pre-checks keep the errors specific; the partial unique indexes stay as a backstop.
create function private.check_goal_slot(p_workspace_id uuid, p_goal_id uuid, p_name text, p_pocket_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.goals where workspace_id = p_workspace_id and archived_at is null
              and lower(name) = lower(p_name) and id is distinct from p_goal_id) then
    perform private.fail('VALIDATION_FAILED', 'name taken');
  end if;
  if p_pocket_id is not null and exists (select 1 from public.goals where pocket_id = p_pocket_id and archived_at is null
                                          and id is distinct from p_goal_id) then
    perform private.fail('POCKET_ALREADY_LINKED');
  end if;
end $$;

create function private.goal_unique_error(p_constraint text) returns void
language plpgsql set search_path = '' as $$
begin
  if p_constraint = 'goals_active_pocket_idx' then perform private.fail('POCKET_ALREADY_LINKED'); end if;
  perform private.fail('VALIDATION_FAILED', 'name taken');
end $$;

-- A target date is optional, must not be in the past (workspace timezone) and not beyond 2100.
create function private.check_goal_date(p_workspace_id uuid, p_date date) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_date is null then return; end if;
  if p_date > date '2100-12-31'
     or p_date < (now() at time zone (select timezone from public.workspaces where id = p_workspace_id))::date then
    perform private.fail('VALIDATION_FAILED', 'target date');
  end if;
end $$;

create function private.check_goal_fields(p_name text, p_note text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_name is null or char_length(p_name) not between 1 and 60 then perform private.fail('VALIDATION_FAILED', 'goal'); end if;
  if char_length(btrim(coalesce(p_note, ''))) > 500 then perform private.fail('VALIDATION_FAILED', 'note'); end if;
end $$;

-- Public RPCs (D-11) -------------------------------------------------------------------
create function public.create_goal(p_workspace_id uuid, p_idempotency_key text, p_name text, p_target_amount text,
  p_target_date date default null, p_note text default null, p_pocket_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_name text := btrim(p_name);
  v_target bigint := private.parse_amount(btrim(p_target_amount));
  v_note text := private.clean_note(p_note);
  v_replay jsonb;
  v_id uuid;
  v_c text;
begin
  perform private.check_goal_fields(v_name, p_note);
  if (select base_currency from public.workspaces where id = p_workspace_id) <> 'IDR' then
    perform private.fail('CURRENCY_NOT_SUPPORTED');
  end if;
  v_replay := private.claim_command(p_workspace_id, 'create_goal', p_idempotency_key, v_actor,
    jsonb_build_object('name', v_name, 'target', v_target::text, 'date', p_target_date, 'note', v_note, 'pocket', p_pocket_id));
  if v_replay is not null then return v_replay; end if;
  -- After the claim, so a slow retry of an accepted command replays instead of failing on a date that has since passed.
  perform private.check_goal_date(p_workspace_id, p_target_date);
  perform private.lock_pockets(p_workspace_id);
  if p_pocket_id is not null then perform private.check_pocket(p_workspace_id, p_pocket_id); end if;
  perform private.check_goal_slot(p_workspace_id, null, v_name, p_pocket_id);
  begin
    insert into public.goals (workspace_id, name, target_amount, currency, target_date, notes, pocket_id)
      values (p_workspace_id, v_name, v_target, 'IDR', p_target_date, v_note, p_pocket_id)
      returning id into v_id;
  exception when unique_violation then
    get stacked diagnostics v_c = constraint_name;
    perform private.goal_unique_error(v_c);
  end;
  perform private.audit(p_workspace_id, v_actor, 'create_goal', 'goal', v_id,
    jsonb_build_object('name', v_name, 'target', v_target::text, 'date', p_target_date, 'note', v_note, 'pocket', p_pocket_id));
  return private.finish_command(p_workspace_id, 'create_goal', p_idempotency_key, jsonb_build_object('goal_id', v_id));
end $$;

-- Naturally idempotent (absolute target state), so no key. Nothing changed = no write and no audit row.
-- Absolute state: an omitted date, note or pocket means "none" and clears it (the audit row records the change).
create function public.update_goal(p_workspace_id uuid, p_goal_id uuid, p_name text, p_target_amount text,
  p_target_date date default null, p_note text default null, p_pocket_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_name text := btrim(p_name);
  v_target bigint := private.parse_amount(btrim(p_target_amount));
  v_note text := private.clean_note(p_note);
  v_old public.goals;
  v_changes jsonb := '{}';
  v_c text;
begin
  perform private.check_goal_fields(v_name, p_note);
  perform private.lock_pockets(p_workspace_id);
  select * into v_old from public.goals where workspace_id = p_workspace_id and id = p_goal_id for update;
  if not found then perform private.fail('VALIDATION_FAILED', 'goal'); end if;
  if v_old.archived_at is not null then perform private.fail('RESOURCE_ARCHIVED'); end if;
  if p_target_date is distinct from v_old.target_date then perform private.check_goal_date(p_workspace_id, p_target_date); end if;
  if p_pocket_id is distinct from v_old.pocket_id and p_pocket_id is not null then
    perform private.check_pocket(p_workspace_id, p_pocket_id);
  end if;
  perform private.check_goal_slot(p_workspace_id, p_goal_id, v_name, p_pocket_id);
  if v_name is distinct from v_old.name then
    v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', v_old.name, 'new', v_name)); end if;
  if v_target is distinct from v_old.target_amount then
    v_changes := v_changes || jsonb_build_object('target', jsonb_build_object('old', v_old.target_amount::text, 'new', v_target::text)); end if;
  if p_target_date is distinct from v_old.target_date then
    v_changes := v_changes || jsonb_build_object('date', jsonb_build_object('old', v_old.target_date, 'new', p_target_date)); end if;
  if v_note is distinct from v_old.notes then
    v_changes := v_changes || jsonb_build_object('note', jsonb_build_object('old', v_old.notes, 'new', v_note)); end if;
  if p_pocket_id is distinct from v_old.pocket_id then
    v_changes := v_changes || jsonb_build_object('pocket', jsonb_build_object('old', v_old.pocket_id, 'new', p_pocket_id)); end if;
  if v_changes <> '{}' then
    begin
      update public.goals set name = v_name, target_amount = v_target, target_date = p_target_date, notes = v_note,
             pocket_id = p_pocket_id where id = p_goal_id;
    exception when unique_violation then
      get stacked diagnostics v_c = constraint_name;
      perform private.goal_unique_error(v_c);
    end;
    perform private.audit(p_workspace_id, v_actor, 'update_goal', 'goal', p_goal_id, v_changes);
  end if;
  return jsonb_build_object('goal_id', p_goal_id);
end $$;

-- Q4: archiving releases the pocket link (its id goes into the audit details); unarchiving comes back unlinked.
create function public.set_goal_archived(p_workspace_id uuid, p_goal_id uuid, p_archived boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.require_writer(p_workspace_id);
  v_old public.goals;
  v_c text;
begin
  perform private.lock_pockets(p_workspace_id);
  select * into v_old from public.goals where workspace_id = p_workspace_id and id = p_goal_id for update;
  if not found or p_archived is null then perform private.fail('VALIDATION_FAILED', 'goal'); end if;
  if p_archived and v_old.archived_at is null then
    update public.goals set archived_at = now(), pocket_id = null where id = p_goal_id;
    perform private.audit(p_workspace_id, v_actor, 'archive_goal', 'goal', p_goal_id,
      jsonb_build_object('released_pocket', v_old.pocket_id));
  elsif not p_archived and v_old.archived_at is not null then
    perform private.check_goal_slot(p_workspace_id, p_goal_id, v_old.name, null);
    begin
      update public.goals set archived_at = null where id = p_goal_id;
    exception when unique_violation then
      get stacked diagnostics v_c = constraint_name;
      perform private.goal_unique_error(v_c);
    end;
    perform private.audit(p_workspace_id, v_actor, 'unarchive_goal', 'goal', p_goal_id);
  end if;
  return jsonb_build_object('goal_id', p_goal_id, 'archived', p_archived);
end $$;

-- G3a function, redefined: a pocket with an active goal cannot be archived (the goal would point at a dead pocket).
-- Everything else is unchanged from 20261125120000_pockets.sql.
create or replace function public.set_pocket_archived(p_workspace_id uuid, p_pocket_id uuid, p_archived boolean)
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
    if exists (select 1 from public.goals where pocket_id = p_pocket_id and archived_at is null) then
      perform private.fail('POCKET_LINKED_TO_GOAL');
    end if;
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

-- Read model (security_invoker; money as text, D-12). floor() so 100 never shows before the target is reached.
create view public.goal_progress with (security_invoker = true) as
select g.id, g.workspace_id, g.name, g.target_amount::text as target_amount, g.currency, g.target_date, g.notes,
       g.pocket_id, g.archived_at, g.created_at,
       s.saved::text as saved,
       greatest(g.target_amount - s.saved, 0)::text as remaining,
       least(100, floor(greatest(s.saved, 0)::numeric * 100 / g.target_amount))::int as percent,
       s.saved >= g.target_amount as is_reached
  from public.goals g
  left join public.pocket_balances pb on pb.id = g.pocket_id
 cross join lateral (select coalesce(pb.balance::bigint, 0) as saved) s;

-- RLS and grants ------------------------------------------------------------------------
alter table public.goals enable row level security;
create policy "goals: members read" on public.goals for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = goals.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active'));

revoke all on public.goals, public.goal_progress from public, anon, authenticated;
grant select on public.goals, public.goal_progress to authenticated;
revoke all on function private.check_goal_slot(uuid, uuid, text, uuid), private.goal_unique_error(text),
  private.check_goal_date(uuid, date), private.check_goal_fields(text, text) from public, anon, authenticated;
revoke all on function public.create_goal(uuid, text, text, text, date, text, uuid),
  public.update_goal(uuid, uuid, text, text, date, text, uuid),
  public.set_goal_archived(uuid, uuid, boolean) from public, anon;
grant execute on function public.create_goal(uuid, text, text, text, date, text, uuid),
  public.update_goal(uuid, uuid, text, text, date, text, uuid),
  public.set_goal_archived(uuid, uuid, boolean) to authenticated;
