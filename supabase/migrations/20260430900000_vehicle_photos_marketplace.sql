-- Standardized marketplace vehicle photos (app table is public.cars, not "vehicles").
-- vehicle_photos.vehicle_id references public.cars(id).

alter table public.cars
  add column if not exists primary_photo_url text;

create table if not exists public.vehicle_photos (
  id uuid default gen_random_uuid() primary key,
  vehicle_id uuid not null references public.cars (id) on delete cascade,
  owner_id uuid not null references auth.users (id),
  angle_key text not null,
  angle_label_pl text not null,
  angle_label_uk text not null,
  photo_url text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (vehicle_id, angle_key)
);

create index if not exists vehicle_photos_vehicle_id_idx on public.vehicle_photos (vehicle_id);
create index if not exists vehicle_photos_owner_id_idx on public.vehicle_photos (owner_id);

alter table public.vehicle_photos enable row level security;

drop policy if exists "owner manages own vehicle photos" on public.vehicle_photos;
drop policy if exists "marketplace photos visible to all" on public.vehicle_photos;
drop policy if exists "vehicle_photos_visible_listed_or_driver" on public.vehicle_photos;

create policy "owner manages own vehicle photos"
  on public.vehicle_photos
  for all
  to authenticated
  using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.cars c
      where c.id = vehicle_photos.vehicle_id
        and c.owner_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.cars c
      where c.id = vehicle_photos.vehicle_id
        and c.owner_id = auth.uid()
    )
  );

create policy "vehicle_photos_visible_listed_or_driver"
  on public.vehicle_photos
  for select
  to authenticated
  using (
    exists (
      select 1 from public.cars c
      where c.id = vehicle_photos.vehicle_id
        and (c.marketplace_listed = true or c.driver_id = auth.uid())
    )
  );

-- Storage: public thumbnails for marketplace cards
insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "vehicle_photos_storage_public_read" on storage.objects;
create policy "vehicle_photos_storage_public_read"
  on storage.objects for select
  using (bucket_id = 'vehicle-photos');

drop policy if exists "vehicle_photos_storage_insert_own" on storage.objects;
create policy "vehicle_photos_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "vehicle_photos_storage_update_own" on storage.objects;
create policy "vehicle_photos_storage_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'vehicle-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "vehicle_photos_storage_delete_own" on storage.objects;
create policy "vehicle_photos_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Marketplace RPC: expose primary_photo_url from cars
drop function if exists public.get_marketplace_listings();

create function public.get_marketplace_listings()
returns table (
  id uuid,
  model text,
  year integer,
  weekly_rent_pln numeric,
  marketplace_photo_url text,
  primary_photo_url text,
  marketplace_description text,
  marketplace_location text,
  marketplace_status text,
  marketplace_listed boolean,
  driver_id uuid,
  deposit_amount numeric,
  fuel_type text,
  transmission text,
  seats integer,
  consumption text,
  marketplace_features text[],
  min_driver_age integer,
  min_experience_years integer,
  min_rental_months integer,
  owner_phone text,
  owner_telegram text,
  plate_number text,
  owner_id uuid,
  partner_names text[],
  partner_contact text,
  apps_available text[],
  registration_city text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.model,
    c.year,
    c.weekly_rent_pln,
    c.marketplace_photo_url,
    c.primary_photo_url,
    c.marketplace_description,
    c.marketplace_location,
    c.marketplace_status,
    c.marketplace_listed,
    c.driver_id,
    c.deposit_amount,
    c.fuel_type,
    c.transmission,
    c.seats,
    c.consumption,
    c.marketplace_features,
    c.min_driver_age,
    c.min_experience_years,
    c.min_rental_months,
    c.owner_phone,
    c.owner_telegram,
    c.plate_number,
    c.owner_id,
    c.partner_names,
    c.partner_contact,
    c.apps_available,
    c.registration_city
  from public.cars c
  where c.marketplace_listed = true
    and c.driver_id is null;
$$;

revoke all on function public.get_marketplace_listings() from public;
grant execute on function public.get_marketplace_listings() to authenticated;
