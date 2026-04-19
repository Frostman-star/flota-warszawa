-- Driver applications (app table is public.cars, not vehicles).
-- Profiles.id equals auth.users.id.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists experience_years integer not null default 0,
  add column if not exists bio text;

-- full_name already exists on profiles from earlier migrations; keep IF NOT EXISTS for greenfield.
alter table public.profiles
  add column if not exists full_name text;

create table if not exists public.driver_applications (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  driver_name text,
  driver_phone text,
  driver_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_applications_status_chk check (status in ('pending', 'accepted', 'rejected'))
);

create unique index if not exists driver_applications_one_pending_per_car_driver_idx
  on public.driver_applications (car_id, driver_id)
  where status = 'pending';

create index if not exists driver_applications_owner_status_idx
  on public.driver_applications (owner_id, status);

create index if not exists driver_applications_driver_idx
  on public.driver_applications (driver_id);

drop trigger if exists driver_applications_set_updated_at on public.driver_applications;
create trigger driver_applications_set_updated_at
  before update on public.driver_applications
  for each row
  execute function public.set_updated_at();

-- In-app notifications
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications (user_id)
  where read_at is null;

alter table public.user_notifications enable row level security;

drop policy if exists user_notifications_select_own on public.user_notifications;
create policy user_notifications_select_own
  on public.user_notifications for select
  using (user_id = auth.uid());

drop policy if exists user_notifications_update_own on public.user_notifications;
create policy user_notifications_update_own
  on public.user_notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke insert, delete on public.user_notifications from authenticated;

-- RLS driver_applications
alter table public.driver_applications enable row level security;

drop policy if exists driver_applications_select_owner on public.driver_applications;
create policy driver_applications_select_owner
  on public.driver_applications for select
  using (owner_id = auth.uid());

drop policy if exists driver_applications_select_driver on public.driver_applications;
create policy driver_applications_select_driver
  on public.driver_applications for select
  using (driver_id = auth.uid());

drop policy if exists driver_applications_insert_driver on public.driver_applications;
create policy driver_applications_insert_driver
  on public.driver_applications for insert
  with check (
    driver_id = auth.uid()
    and owner_id is not null
    and exists (
      select 1
      from public.cars c
      where c.id = car_id
        and c.owner_id = owner_id
        and coalesce(c.marketplace_listed, false) = true
        and c.driver_id is null
    )
  );

drop policy if exists driver_applications_update_owner on public.driver_applications;
create policy driver_applications_update_owner
  on public.driver_applications for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Owner: new application → in-app notification
create or replace function public.enqueue_owner_new_driver_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_app_id uuid;
  v_car_id uuid;
  v_driver_id uuid;
begin
  -- Avoid PL variables inside jsonb_build_object (parsed as relations in some clients → 42P01).
  -- Build JSON from a plain SQL join row via to_jsonb(sub.*).
  v_app_id := new.id;
  v_car_id := new.car_id;
  v_driver_id := new.driver_id;

  select to_jsonb(sub.*)
  into v_payload
  from (
    select
      da.id as application_id,
      da.car_id,
      da.driver_id,
      coalesce(c.plate_number::text, '') as plate
    from public.driver_applications da
    inner join public.cars c on c.id = da.car_id
    where da.id = v_app_id
    limit 1
  ) sub;

  if v_payload is null then
    execute format(
      'select jsonb_build_object(''application_id'', %L::uuid, ''car_id'', %L::uuid, ''driver_id'', %L::uuid, ''plate'', %L::text)',
      v_app_id,
      v_car_id,
      v_driver_id,
      ''
    ) into v_payload;
  end if;

  insert into public.user_notifications (user_id, kind, payload)
  values (new.owner_id, 'driver_application_new', v_payload);
  return new;
end;
$$;

drop trigger if exists driver_applications_notify_owner on public.driver_applications;
create trigger driver_applications_notify_owner
  after insert on public.driver_applications
  for each row
  execute function public.enqueue_owner_new_driver_application();

create or replace function public.accept_driver_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_car_id uuid;
  v_driver_id uuid;
  v_plate text;
begin
  select da.owner_id, da.car_id, da.driver_id
    into v_owner, v_car_id, v_driver_id
  from public.driver_applications da
  where da.id = p_application_id
    and da.status = 'pending'
  for update;

  if not found then
    raise exception 'application_not_pending';
  end if;

  if v_owner is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  select c.plate_number into v_plate from public.cars c where c.id = v_car_id limit 1;

  update public.driver_applications
  set status = 'accepted', updated_at = now()
  where id = p_application_id;

  update public.driver_applications
  set status = 'rejected', updated_at = now()
  where car_id = v_car_id
    and status = 'pending'
    and id <> p_application_id;

  update public.cars
  set
    driver_id = v_driver_id,
    marketplace_listed = false,
    show_in_marketplace = false,
    marketplace_status = 'zajete',
    updated_at = now()
  where id = v_car_id
    and owner_id = auth.uid();

  insert into public.user_notifications (user_id, kind, payload)
  values (
    v_driver_id,
    'application_accepted',
    jsonb_build_object(
      'application_id', p_application_id,
      'car_id', v_car_id,
      'plate', coalesce(v_plate, '')
    )
  );

  return v_car_id;
end;
$$;

revoke all on function public.accept_driver_application(uuid) from public;
grant execute on function public.accept_driver_application(uuid) to authenticated;

create or replace function public.reject_driver_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_driver_id uuid;
  v_car_id uuid;
  v_plate text;
begin
  select da.owner_id, da.driver_id, da.car_id
    into v_owner, v_driver_id, v_car_id
  from public.driver_applications da
  where da.id = p_application_id
    and da.status = 'pending'
  for update;

  if not found then
    raise exception 'application_not_pending';
  end if;

  if v_owner is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  select c.plate_number into v_plate from public.cars c where c.id = v_car_id limit 1;

  update public.driver_applications
  set status = 'rejected', updated_at = now()
  where id = p_application_id;

  insert into public.user_notifications (user_id, kind, payload)
  values (
    v_driver_id,
    'application_rejected',
    jsonb_build_object(
      'application_id', p_application_id,
      'car_id', v_car_id,
      'plate', coalesce(v_plate, '')
    )
  );
end;
$$;

revoke all on function public.reject_driver_application(uuid) from public;
grant execute on function public.reject_driver_application(uuid) to authenticated;

-- Marketplace RPC: expose plate + owner for driver apply flow
-- OUT/return shape changed vs older migration — must drop first (42P13).
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
  owner_id uuid
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
    c.owner_id
  from public.cars c
  where c.marketplace_listed = true
    and c.driver_id is null;
$$;

revoke all on function public.get_marketplace_listings() from public;
grant execute on function public.get_marketplace_listings() to authenticated;
