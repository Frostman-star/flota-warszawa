-- Per-fleet isolation: owner_id on cars + profiles, RLS replaces global admin access to all rows.
-- App table name is public.cars (not "vehicles").

alter table public.profiles
  add column if not exists owner_id uuid references auth.users (id);

alter table public.cars
  add column if not exists owner_id uuid references auth.users (id);

-- Fleet managers anchor their own fleet id.
update public.profiles p
set owner_id = p.id
where p.owner_id is null
  and p.role in ('admin'::public.user_role, 'owner'::public.user_role);

-- Legacy drivers with no owner: attach to earliest fleet owner (single-tenant default).
update public.profiles p
set owner_id = fo.id
from (
  select p2.id
  from public.profiles p2
  where p2.role in ('admin'::public.user_role, 'owner'::public.user_role)
  order by p2.created_at asc nulls last
  limit 1
) fo
where p.owner_id is null
  and p.role = 'driver'::public.user_role;

-- Cars: inherit from assigned driver's fleet when possible.
update public.cars c
set owner_id = d.owner_id
from public.profiles d
where c.owner_id is null
  and c.driver_id is not null
  and d.id = c.driver_id
  and d.owner_id is not null;

-- Remaining cars: same single-owner fallback.
update public.cars c
set owner_id = fo.id
from (
  select p.id
  from public.profiles p
  where p.role in ('admin'::public.user_role, 'owner'::public.user_role)
  order by p.created_at asc nulls last
  limit 1
) fo
where c.owner_id is null;

create index if not exists profiles_owner_id_idx on public.profiles (owner_id);
create index if not exists cars_owner_id_idx on public.cars (owner_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  fleet_owner uuid;
begin
  r := lower(trim(coalesce(new.raw_user_meta_data->>'signup_role', 'driver')));
  if r not in ('owner', 'driver') then
    r := 'driver';
  end if;

  fleet_owner := case
    when r = 'owner' then new.id
    when nullif(trim(coalesce(new.raw_user_meta_data->>'fleet_owner_id', '')), '') is not null
      then (nullif(trim(new.raw_user_meta_data->>'fleet_owner_id'), ''))::uuid
    else null
  end;

  insert into public.profiles (id, email, full_name, role, owner_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    r::public.user_role,
    fleet_owner
  );
  return new;
end;
$$;

-- --- profiles RLS ---
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_owner_select_drivers" on public.profiles;
drop policy if exists "users see own profile" on public.profiles;
drop policy if exists "owner sees their drivers" on public.profiles;

create policy "users see own profile"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "owner sees their drivers"
  on public.profiles for select
  using (role = 'driver'::public.user_role and owner_id = auth.uid());

-- --- cars RLS ---
drop policy if exists "cars_admin_all" on public.cars;
drop policy if exists "owners see own vehicles" on public.cars;
drop policy if exists "cars_owner_manage" on public.cars;

create policy "owners see own vehicles"
  on public.cars for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "cars_driver_update_assigned" on public.cars;
create policy "cars_driver_update_assigned"
  on public.cars for update
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

-- --- car_history RLS ---
drop policy if exists "car_history_admin_all" on public.car_history;
drop policy if exists "car_history_owner_all" on public.car_history;

create policy "car_history_owner_all"
  on public.car_history for all
  using (
    exists (
      select 1 from public.cars c
      where c.id = car_history.car_id
        and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cars c
      where c.id = car_history.car_id
        and c.owner_id = auth.uid()
    )
  );

drop policy if exists "car_history_driver_insert" on public.car_history;
create policy "car_history_driver_insert"
  on public.car_history for insert
  with check (
    exists (
      select 1 from public.cars c
      where c.id = car_history.car_id
        and c.driver_id = auth.uid()
    )
  );

-- Marketplace: any authenticated user may read listings (not scoped by owner_id).
drop policy if exists cars_marketplace_select on public.cars;
create policy cars_marketplace_select
  on public.cars for select
  to authenticated
  using (
    show_in_marketplace = true
    and marketplace_status = 'dostepne'
  );
