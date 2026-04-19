-- Pojazdy (public.cars): assigned_driver_id → driver_id, max. jedno auto na kierowcę.
drop policy if exists "cars_driver_select_assigned" on public.cars;
drop policy if exists "car_history_driver_select" on public.car_history;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cars' and column_name = 'assigned_driver_id'
  ) then
    alter table public.cars rename column assigned_driver_id to driver_id;
  end if;
end $$;

-- Indeks po starej nazwie (jeśli istnieje)
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'cars_assigned_driver_id_idx'
  ) then
    alter index public.cars_assigned_driver_id_idx rename to cars_driver_id_idx;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'cars_assigned_driver_id_fkey' and conrelid = 'public.cars'::regclass
  ) then
    alter table public.cars rename constraint cars_assigned_driver_id_fkey to cars_driver_id_fkey;
  end if;
end $$;

-- Przed unikalnym indeksem: zostaw jedno auto na kierowcę (najstarsze wg created_at).
with ranked as (
  select id,
    row_number() over (
      partition by driver_id
      order by created_at nulls last, id
    ) as rn
  from public.cars
  where driver_id is not null
)
update public.cars c
set driver_id = null
from ranked r
where c.id = r.id and r.rn > 1;

create unique index if not exists cars_driver_id_unique on public.cars (driver_id) where driver_id is not null;

create index if not exists cars_driver_id_idx on public.cars (driver_id);

create policy "cars_driver_select_assigned"
  on public.cars for select
  using (driver_id = auth.uid());

create policy "car_history_driver_select"
  on public.car_history for select
  using (
    exists (
      select 1 from public.cars c
      where c.id = car_history.car_id
        and c.driver_id = auth.uid()
    )
  );
