-- Services monetization (free + featured requests) and admin management policies.

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'service_plan_tier'
  ) then
    create type public.service_plan_tier as enum ('free', 'featured');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'plan_tier'
  ) then
    alter table public.services
      add column plan_tier public.service_plan_tier not null default 'free';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'featured_until'
  ) then
    alter table public.services add column featured_until timestamptz;
  end if;
end $$;

create table if not exists public.service_featured_requests (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_featured_requests_service_status_idx
  on public.service_featured_requests (service_id, status);

create index if not exists service_featured_requests_requested_by_idx
  on public.service_featured_requests (requested_by, created_at desc);

drop trigger if exists service_featured_requests_updated_at on public.service_featured_requests;
create trigger service_featured_requests_updated_at
  before update on public.service_featured_requests
  for each row execute function public.set_updated_at();

alter table public.service_featured_requests enable row level security;

drop policy if exists "services_update_by_admin" on public.services;
create policy "services_update_by_admin"
  on public.services for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "featured_requests_insert_by_service_owner" on public.service_featured_requests;
drop policy if exists "featured_requests_select_own_or_admin" on public.service_featured_requests;
drop policy if exists "featured_requests_admin_update" on public.service_featured_requests;

create policy "featured_requests_insert_by_service_owner"
  on public.service_featured_requests for insert
  with check (
    requested_by = auth.uid()
    and exists (
      select 1
      from public.service_profiles sp
      where sp.id = auth.uid()
        and sp.service_id = service_featured_requests.service_id
    )
  );

create policy "featured_requests_select_own_or_admin"
  on public.service_featured_requests for select
  using (
    requested_by = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.service_profiles sp
      where sp.id = auth.uid()
        and sp.service_id = service_featured_requests.service_id
    )
  );

create policy "featured_requests_admin_update"
  on public.service_featured_requests for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "slots_admin_manage_all" on public.service_slots;
drop policy if exists "bookings_admin_manage_all" on public.service_bookings;

create policy "slots_admin_manage_all"
  on public.service_slots for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "bookings_admin_manage_all"
  on public.service_bookings for all
  using (public.is_admin())
  with check (public.is_admin());
