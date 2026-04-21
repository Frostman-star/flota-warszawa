-- Aggregate "how often this listing was meaningfully seen" in marketplace / public fleet cards.
-- Incremented via RPC (anon + authenticated); skips the car owner viewing their own listing.

alter table public.cars
  add column if not exists marketplace_view_count integer not null default 0;

comment on column public.cars.marketplace_view_count is
  'Rough count of catalog listing impressions (incremented from client via increment_car_marketplace_view).';

create or replace function public.increment_car_marketplace_view(p_car_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rc integer := 0;
begin
  update public.cars
  set marketplace_view_count = marketplace_view_count + 1
  where id = p_car_id
    and coalesce(marketplace_listed, false) = true
    and driver_id is null
    and not (auth.uid() is not null and auth.uid() = owner_id);
  get diagnostics rc = row_count;
  return rc;
end;
$$;

revoke all on function public.increment_car_marketplace_view(uuid) from public;
grant execute on function public.increment_car_marketplace_view(uuid) to anon, authenticated;
