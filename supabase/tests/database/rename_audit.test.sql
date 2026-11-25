-- Direct renames are audited with old/new names; archived pockets cannot be renamed; pocket updated_at moves.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'rename-ana@test.local', '{}', 'authenticated', 'authenticated');
create temp table t (k text primary key, v uuid);
grant all on t to authenticated;
insert into t (k, v) values ('ws', (select id from public.workspaces where personal_owner_id = 'eeeeeeee-0000-0000-0000-000000000001'));

set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}';
insert into t (k, v) select 'acc', (public.create_financial_account((select v from t where k = 'ws'), 'rn-acc-0001', 'bank', 'BCA') ->> 'financial_account_id')::uuid;
insert into t (k, v) select 'p1', (public.create_pocket((select v from t where k = 'ws'), 'rn-pk-0001', 'Darurat') ->> 'pocket_id')::uuid;
insert into t (k, v) select 'p2', (public.create_pocket((select v from t where k = 'ws'), 'rn-pk-0002', 'Lama') ->> 'pocket_id')::uuid;
select public.set_pocket_archived((select v from t where k = 'ws'), (select v from t where k = 'p2'), true);

reset role;
update public.pockets set updated_at = '2000-01-01' where id = (select v from t where k = 'p1');
set local role authenticated;
update public.pockets set name = 'Dana Darurat' where id = (select v from t where k = 'p1');
update public.financial_accounts set name = 'BCA Utama' where id = (select v from t where k = 'acc');
update public.pockets set name = 'Baru' where id = (select v from t where k = 'p2');
insert into t (k, v) select 'acc_old', (public.create_financial_account((select v from t where k = 'ws'), 'rn-acc-0002', 'cash', 'Kas Lama') ->> 'financial_account_id')::uuid;
select public.set_financial_account_archived((select v from t where k = 'ws'), (select v from t where k = 'acc_old'), true);
update public.financial_accounts set name = 'Kas Baru' where id = (select v from t where k = 'acc_old');

reset role;
select is((select details from public.audit_logs where action = 'rename_pocket' and entity_id = (select v from t where k = 'p1')),
  '{"old": "Darurat", "new": "Dana Darurat"}'::jsonb, 'pocket rename audited with old/new');
select is((select actor from public.audit_logs where action = 'rename_pocket' and entity_id = (select v from t where k = 'p1')),
  'eeeeeeee-0000-0000-0000-000000000001'::uuid, 'rename actor recorded');
select is((select details ->> 'new' from public.audit_logs where action = 'rename_account' and entity_id = (select v from t where k = 'acc')),
  'BCA Utama', 'account rename audited');
select ok((select updated_at > '2000-01-02' from public.pockets where id = (select v from t where k = 'p1')), 'pocket updated_at moves on rename');
select is((select name from public.pockets where id = (select v from t where k = 'p2')), 'Lama', 'archived pocket cannot be renamed');
select is((select count(*)::int from public.audit_logs where action like 'rename_%' and entity_id = (select v from t where k = 'p2')), 0, 'no audit for a blocked rename');
select is((select name from public.financial_accounts where id = (select v from t where k = 'acc_old')), 'Kas Lama', 'archived account cannot be renamed');
select is((select count(*)::int from public.audit_logs where action = 'rename_pocket' and entity_id = (select v from t where k = 'p2')), 0,
  'archiving (no name change) writes no rename audit');

select * from finish();
rollback;
