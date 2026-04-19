-- Multiple fleet partners per car (app table is public.cars).

alter table public.cars
  add column if not exists partner_names text[] not null default '{}'::text[];

update public.cars
set partner_names = array[trim(partner_name)]::text[]
where partner_name is not null
  and trim(partner_name) <> '';

drop function if exists public.get_marketplace_listings();

create function public.get_marketplace_listings()
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
