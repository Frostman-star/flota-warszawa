-- Flota Warszawa — uruchom w Supabase SQL Editor
-- Właściciel floty: role = 'owner' | 'driver' (legacy: 'admin' traktowany jak owner w is_admin())

create extension if not exists "pgcrypto";

-- Role użytkowników (admin = legacy; owner = właściciel floty z rejestracji)
create type public.user_role as enum ('admin', 'driver', 'owner');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  role public.user_role not null default 'driver',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cars (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null unique,
  model text not null default '',
  year int,
  color_label text not null default '',
  assigned_driver_id uuid references public.profiles (id) on delete set null,
  driver_label text not null default '',
  mileage_km int not null default 0,
  weekly_rent_pln numeric(12,2) not null default 0,
  fines_count int not null default 0,
  oc_expiry date,
  ac_expiry date,
  przeglad_expiry date,
  last_service_date date,
  notes text not null default '',
  show_in_marketplace boolean not null default false,
  marketplace_status text not null default 'zajete',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cars_marketplace_status_check check (marketplace_status in ('dostepne', 'zajete'))
);

create type public.car_history_event as enum ('mileage', 'service');

create table public.car_history (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  event_type public.car_history_event not null,
  previous_mileage int,
  new_mileage int,
  detail text not null default '',
  service_type text,
  cost_pln numeric(12,2),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create index cars_assigned_driver_id_idx on public.cars (assigned_driver_id);
create index car_history_car_id_idx on public.car_history (car_id);

-- Aktualizacja updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger cars_updated_at
  before update on public.cars
  for each row execute function public.set_updated_at();

-- Kierowca nie może sam zmienić roli na admin (z aplikacji z JWT).
-- W SQL Editor Supabase auth.uid() jest NULL — wtedy nie blokujemy (np. pierwsze nadanie admina).
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Brak uprawnień do zmiany roli';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.prevent_profile_role_escalation();

-- Profil przy rejestracji
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  r := lower(trim(coalesce(new.raw_user_meta_data->>'signup_role', 'driver')));
  if r not in ('owner', 'driver') then
    r := 'driver';
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    r::public.user_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.car_history enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin'::public.user_role, 'owner'::public.user_role)
  );
$$;

-- profiles
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_update"
  on public.profiles for update
  using (public.is_admin());

-- cars
create policy "cars_admin_all"
  on public.cars for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "cars_driver_select_assigned"
  on public.cars for select
  using (assigned_driver_id = auth.uid());

-- car_history
create policy "car_history_admin_all"
  on public.car_history for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "car_history_driver_select"
  on public.car_history for select
  using (
    exists (
      select 1 from public.cars c
      where c.id = car_history.car_id
        and c.assigned_driver_id = auth.uid()
    )
  );
