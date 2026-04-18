-- Etykieta kierowcy (tekst z kreatora) + marketplace
alter table public.cars
  add column if not exists driver_label text not null default '';

alter table public.cars
  add column if not exists show_in_marketplace boolean not null default false;

alter table public.cars
  add column if not exists marketplace_status text not null default 'zajete';

-- Ograniczenie wartości (bez enum — prościej migracje)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cars_marketplace_status_check'
  ) then
    alter table public.cars
      add constraint cars_marketplace_status_check
      check (marketplace_status in ('dostepne', 'zajete'));
  end if;
end $$;

alter table public.company_settings
  add column if not exists contact_email text;

-- Oglądanie aut w marketplace (zalogowani, nie-admin też — OR z polityką admina)
drop policy if exists cars_marketplace_select on public.cars;
create policy cars_marketplace_select
  on public.cars for select
  to authenticated
  using (
    show_in_marketplace = true
    and marketplace_status = 'dostepne'
    and not public.is_admin()
  );
