-- G2a (docs/G2A_FINANCE_CORE_DRAFT_V1.md §4.1): currency reference data.
-- Read-only to signed-in users. G2a only accepts the workspace base currency for accounts.

create table public.currencies (
  code char(3) primary key check (code ~ '^[A-Z]{3}$'),
  minor_units smallint not null check (minor_units between 0 and 4),
  name text not null
);

insert into public.currencies (code, minor_units, name) values
  ('IDR', 0, 'Rupiah Indonesia'),
  ('USD', 2, 'US Dollar'),
  ('SGD', 2, 'Singapore Dollar'),
  ('MYR', 2, 'Malaysian Ringgit'),
  ('EUR', 2, 'Euro'),
  ('JPY', 0, 'Japanese Yen');

alter table public.currencies enable row level security;
create policy "currencies: signed-in users read" on public.currencies
  for select to authenticated using (true);
revoke all on public.currencies from public, anon, authenticated;
grant select on public.currencies to authenticated;

-- Every workspace base currency must be a known currency.
alter table public.workspaces
  add constraint workspaces_base_currency_fkey foreign key (base_currency) references public.currencies (code);
