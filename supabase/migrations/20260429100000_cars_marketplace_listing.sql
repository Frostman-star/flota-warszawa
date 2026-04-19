-- Marketplace listing fields. The app uses public.cars (not "vehicles").
alter table public.cars
  add column if not exists marketplace_listed boolean not null default false,
  add column if not exists marketplace_photo_url text,
  add column if not exists marketplace_description text,
  add column if not exists marketplace_location text default 'Warszawa';

alter table public.company_settings
  add column if not exists contact_phone text;

-- Preserve behaviour for rows that were already shown as available listings.
update public.cars
set marketplace_listed = true
where show_in_marketplace = true
  and marketplace_status = 'dostepne'
  and driver_id is null;

drop policy if exists cars_marketplace_select on public.cars;
create policy cars_marketplace_select
  on public.cars for select
  to authenticated
  using (
    marketplace_listed = true
    and driver_id is null
  );
