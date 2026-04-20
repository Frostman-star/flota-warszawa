-- Split "contact" vs "assign to car": assignment is done via assign_driver_from_application (e.g. from chat UI).
-- accept_driver_application remains as a thin wrapper for backwards compatibility (same behaviour).

create or replace function public.assign_driver_from_application(p_application_id uuid)
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

revoke all on function public.assign_driver_from_application(uuid) from public;
grant execute on function public.assign_driver_from_application(uuid) to authenticated;

create or replace function public.accept_driver_application(p_application_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.assign_driver_from_application(p_application_id);
$$;
