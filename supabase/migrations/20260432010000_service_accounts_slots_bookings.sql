-- Service accounts + slots + repair bookings (MVP).

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role'
      and e.enumlabel = 'service'
  ) then
    alter type public.user_role add value 'service';
  end if;
end $$;

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
  if r not in ('owner', 'driver', 'service') then
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

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'service_booking_status'
  ) then
    create type public.service_booking_status as enum (
      'pending',
      'confirmed',
      'in_progress',
      'done',
      'canceled'
    );
  end if;
end $$;

create table if not exists public.service_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  display_name text not null default '',
  contact_phone text,
  contact_email text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists service_profiles_service_id_unique
  on public.service_profiles (service_id);

create table if not exists public.service_slots (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  slot_start_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 30 and 240),
  is_available boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists service_slots_service_start_unique
  on public.service_slots (service_id, slot_start_at);

create index if not exists service_slots_service_time_idx
  on public.service_slots (service_id, slot_start_at);

create table if not exists public.service_bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  slot_id uuid references public.service_slots (id) on delete set null,
  customer_user_id uuid not null references public.profiles (id) on delete cascade,
  customer_car_id uuid references public.cars (id) on delete set null,
  issue_description text not null default '',
  status public.service_booking_status not null default 'pending',
  status_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_bookings_issue_len check (char_length(issue_description) <= 2000)
);

create unique index if not exists service_bookings_slot_unique
  on public.service_bookings (slot_id)
  where slot_id is not null;

create index if not exists service_bookings_service_status_idx
  on public.service_bookings (service_id, status);

create index if not exists service_bookings_customer_created_idx
  on public.service_bookings (customer_user_id, created_at desc);

create or replace function public.reserve_service_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slot_id is null then
    return new;
  end if;

  update public.service_slots
  set is_available = false
  where id = new.slot_id
    and service_id = new.service_id
    and is_available = true
    and slot_start_at >= now();

  if not found then
    raise exception 'Slot is not available';
  end if;

  return new;
end;
$$;

drop trigger if exists service_bookings_reserve_slot on public.service_bookings;
create trigger service_bookings_reserve_slot
  before insert on public.service_bookings
  for each row execute function public.reserve_service_slot();

drop trigger if exists service_profiles_updated_at on public.service_profiles;
create trigger service_profiles_updated_at
  before update on public.service_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists service_slots_updated_at on public.service_slots;
create trigger service_slots_updated_at
  before update on public.service_slots
  for each row execute function public.set_updated_at();

drop trigger if exists service_bookings_updated_at on public.service_bookings;
create trigger service_bookings_updated_at
  before update on public.service_bookings
  for each row execute function public.set_updated_at();

alter table public.service_profiles enable row level security;
alter table public.service_slots enable row level security;
alter table public.service_bookings enable row level security;

drop policy if exists "service_profiles_select_own" on public.service_profiles;
drop policy if exists "service_profiles_upsert_own" on public.service_profiles;
drop policy if exists "service_profiles_update_own" on public.service_profiles;
drop policy if exists "service_profiles_admin_select" on public.service_profiles;

create policy "service_profiles_select_own"
  on public.service_profiles for select
  using (id = auth.uid());

create policy "service_profiles_upsert_own"
  on public.service_profiles for insert
  with check (id = auth.uid());

create policy "service_profiles_update_own"
  on public.service_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "service_profiles_admin_select"
  on public.service_profiles for select
  using (public.is_admin());

drop policy if exists "slots_public_read_available" on public.service_slots;
drop policy if exists "slots_service_manage_own" on public.service_slots;

create policy "slots_public_read_available"
  on public.service_slots for select
  using (is_available = true and slot_start_at >= now());

create policy "slots_service_manage_own_insert"
  on public.service_slots for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1
      from public.service_profiles sp
      where sp.id = auth.uid()
        and sp.service_id = service_slots.service_id
    )
    and created_by = auth.uid()
  );

create policy "slots_service_manage_own_update"
  on public.service_slots for update
  using (
    exists (
      select 1
      from public.service_profiles sp
      where sp.id = auth.uid()
        and sp.service_id = service_slots.service_id
    )
  )
  with check (
    exists (
      select 1
      from public.service_profiles sp
      where sp.id = auth.uid()
        and sp.service_id = service_slots.service_id
    )
  );

create policy "slots_service_manage_own_delete"
  on public.service_slots for delete
  using (
    exists (
      select 1
      from public.service_profiles sp
      where sp.id = auth.uid()
        and sp.service_id = service_slots.service_id
    )
  );

drop policy if exists "bookings_customer_insert" on public.service_bookings;
drop policy if exists "bookings_customer_select_own" on public.service_bookings;
drop policy if exists "bookings_service_select_own" on public.service_bookings;
drop policy if exists "bookings_service_update_status" on public.service_bookings;

create policy "bookings_customer_insert"
  on public.service_bookings for insert
  with check (
    auth.uid() is not null
    and customer_user_id = auth.uid()
    and (
      slot_id is null
      or exists (
        select 1
        from public.service_slots ss
        where ss.id = service_bookings.slot_id
          and ss.service_id = service_bookings.service_id
          and ss.is_available = true
          and ss.slot_start_at >= now()
      )
    )
  );

create policy "bookings_customer_select_own"
  on public.service_bookings for select
  using (customer_user_id = auth.uid());

create policy "bookings_service_select_own"
  on public.service_bookings for select
  using (
    exists (
      select 1
      from public.service_profiles sp
      where sp.id = auth.uid()
        and sp.service_id = service_bookings.service_id
    )
  );

create policy "bookings_service_update_status"
  on public.service_bookings for update
  using (
    exists (
      select 1
      from public.service_profiles sp
      where sp.id = auth.uid()
        and sp.service_id = service_bookings.service_id
    )
  )
  with check (
    exists (
      select 1
      from public.service_profiles sp
      where sp.id = auth.uid()
        and sp.service_id = service_bookings.service_id
    )
  );
