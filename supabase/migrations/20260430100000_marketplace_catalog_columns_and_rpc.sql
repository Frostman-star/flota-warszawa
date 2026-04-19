-- Marketplace catalog: extra columns on public.cars (app uses "cars", not "vehicles").
alter table public.cars
  add column if not exists deposit_amount numeric(12, 2) not null default 0,
  add column if not exists fuel_type text not null default 'benzyna',
  add column if not exists transmission text not null default 'automat',
  add column if not exists seats integer not null default 5,
  add column if not exists consumption text,
  add column if not exists marketplace_features text[] not null default '{}'::text[],
  add column if not exists min_driver_age integer not null default 25,
  add column if not exists min_experience_years integer not null default 3,
  add column if not exists min_rental_months integer not null default 1,
  add column if not exists owner_phone text,
  add column if not exists owner_telegram text;

alter table public.company_settings
  add column if not exists contact_telegram text;

-- Stable read path for drivers (bypasses RLS on cars inside the function).
create or replace function public.get_marketplace_listings()
returns table (
  id uuid,
  model text,
  year integer,
  weekly_rent_pln numeric,
  marketplace_photo_url text,
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
  owner_telegram text
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
    c.owner_telegram
  from public.cars c
  where c.marketplace_listed = true
    and c.driver_id is null;
$$;

revoke all on function public.get_marketplace_listings() from public;
grant execute on function public.get_marketplace_listings() to authenticated;
