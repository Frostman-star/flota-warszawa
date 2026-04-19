-- Driver favorites for marketplace cars.
-- App table name is public.cars (not vehicles).

create table if not exists public.driver_favorites (
  id uuid default gen_random_uuid() primary key,
  driver_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.cars(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (driver_id, vehicle_id)
);

alter table public.driver_favorites enable row level security;

drop policy if exists "drivers manage own favorites" on public.driver_favorites;
create policy "drivers manage own favorites"
  on public.driver_favorites
  for all
  to authenticated
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());
