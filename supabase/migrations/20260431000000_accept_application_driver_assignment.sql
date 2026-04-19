-- Fix accept_driver_application: clear driver from previous car before assign (unique partial index on cars.driver_id).
-- Peek RPC for owners: see if applicant is already assigned elsewhere (cross-fleet), before accepting.
-- Allow assigned drivers to read fleet owner profile (name) for their current car.

create or replace function public.get_driver_current_assignment_for_application(p_application_id uuid)
returns table (
  plate text,
  current_car_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_driver uuid;
begin
  select da.owner_id, da.driver_id
    into v_owner, v_driver
  from public.driver_applications da
  where da.id = p_application_id
    and da.status = 'pending';

  if not found then
    return;
  end if;

  if v_owner is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  return query
  select c.plate_number::text, c.id
  from public.cars c
  where c.driver_id = v_driver
  limit 1;
end;
$$;

revoke all on function public.get_driver_current_assignment_for_application(uuid) from public;
grant execute on function public.get_driver_current_assignment_for_application(uuid) to authenticated;

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
  v_rows int;
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

  update public.cars
  set
    driver_id = null,
    updated_at = now()
  where driver_id = v_driver_id;

  update public.cars
  set
    driver_id = v_driver_id,
    marketplace_listed = false,
    show_in_marketplace = false,
    marketplace_status = 'zajete',
    updated_at = now()
  where id = v_car_id
    and owner_id = auth.uid();

  get diagnostics v_rows = row_count;
  if v_rows < 1 then
    raise exception 'car_assign_failed';
  end if;

  update public.driver_applications
  set status = 'accepted', updated_at = now()
  where id = p_application_id;

  update public.driver_applications
  set status = 'rejected', updated_at = now()
  where car_id = v_car_id
    and status = 'pending'
    and id <> p_application_id;

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

drop policy if exists "drivers_select_assigned_car_owner_profile" on public.profiles;
create policy "drivers_select_assigned_car_owner_profile"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.cars c
      where c.driver_id = auth.uid()
        and c.owner_id = profiles.id
    )
  );
