-- Direct-table renames (pockets, financial accounts) go through RLS, not an RPC, so a trigger records them in
-- the audit log with old/new names; pockets also get updated_at maintenance, and archived pockets stay frozen.
create function private.audit_rename() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.name is distinct from old.name then
    insert into public.audit_logs (workspace_id, actor, action, entity, entity_id, details)
    values (new.workspace_id, auth.uid(), 'rename_' || tg_argv[0], tg_argv[0], new.id,
            jsonb_build_object('old', old.name, 'new', new.name));
  end if;
  return null;
end $$;
revoke all on function private.audit_rename() from public, anon, authenticated;

create trigger pockets_set_updated_at before update on public.pockets
  for each row execute function private.set_updated_at();
create trigger pockets_audit_rename after update of name on public.pockets
  for each row execute function private.audit_rename('pocket');
create trigger financial_accounts_audit_rename after update of name on public.financial_accounts
  for each row execute function private.audit_rename('account');

drop policy "pockets: writers rename" on public.pockets;
create policy "pockets: writers rename" on public.pockets for update to authenticated
  using (archived_at is null and exists (select 1 from public.workspace_members m where m.workspace_id = pockets.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = pockets.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));

drop policy "financial_accounts: writers rename" on public.financial_accounts;
create policy "financial_accounts: writers rename" on public.financial_accounts for update to authenticated
  using (archived_at is null and exists (select 1 from public.workspace_members m where m.workspace_id = financial_accounts.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = financial_accounts.workspace_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));
