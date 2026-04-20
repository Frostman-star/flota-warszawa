-- Driver-initiated end / change-intent for current assignment. Owner must confirm actual release (terminate).

create table if not exists public.driver_employment_requests (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  driver_id uuid not null references auth.users (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  reason_code text not null,
  reason_note text,
  status text not null default 'pending_owner',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint driver_employment_requests_kind_chk check (kind in ('terminate', 'change_vehicle_intent')),
  constraint driver_employment_requests_status_chk check (
    status in ('pending_owner', 'completed', 'cancelled_by_driver', 'rejected_by_owner')
  ),
  constraint driver_employment_requests_reason_chk check (
    (kind = 'terminate' and reason_code in (
      'reason_mutual',
      'reason_schedule',
      'reason_pay',
      'reason_vehicle',
      'reason_personal',
      'reason_other'
    ))
    or (kind = 'change_vehicle_intent' and reason_code = 'reason_change_vehicle')
  ),
  constraint driver_employment_requests_reason_note_len check (
    reason_note is null
    or (char_length(reason_note) <= 2000)
  )
);

create unique index if not exists driver_employment_requests_one_pending_per_car_driver_idx
  on public.driver_employment_requests (car_id, driver_id)
  where status = 'pending_owner';

create index if not exists driver_employment_requests_owner_status_idx
  on public.driver_employment_requests (owner_id, status, created_at desc);

alter table public.driver_employment_requests enable row level security;

drop policy if exists driver_employment_requests_select_parties on public.driver_employment_requests;
create policy driver_employment_requests_select_parties
  on public.driver_employment_requests for select
  using (driver_id = auth.uid() or owner_id = auth.uid());

revoke insert, update, delete on public.driver_employment_requests from authenticated;
grant select on public.driver_employment_requests to authenticated;

-- Driver: submit request (terminate with reason, or "want different car" intent)
create or replace function public.driver_submit_employment_request(
  p_car_id uuid,
  p_kind text,
  p_reason_code text,
  p_reason_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := auth.uid();
  v_owner uuid;
  v_plate text;
  v_note text := nullif(trim(coalesce(p_reason_note, '')), '');
  v_code text;
  v_id uuid;
begin
  if v_driver is null then
    raise exception 'forbidden';
  end if;

  if p_kind is null or p_kind not in ('terminate', 'change_vehicle_intent') then
    raise exception 'invalid_kind';
  end if;

  if not exists (
    select 1
    from public.cars c
    where c.id = p_car_id
      and c.driver_id = v_driver
  ) then
    raise exception 'not_assigned_to_car';
  end if;

  if exists (
    select 1
    from public.driver_employment_requests r
    where r.car_id = p_car_id
      and r.driver_id = v_driver
      and r.status = 'pending_owner'
  ) then
    raise exception 'pending_request_exists';
  end if;

  select c.owner_id, coalesce(c.plate_number::text, '')
    into v_owner, v_plate
  from public.cars c
  where c.id = p_car_id
  limit 1;

  if p_kind = 'change_vehicle_intent' then
    v_code := 'reason_change_vehicle';
  else
    v_code := nullif(trim(coalesce(p_reason_code, '')), '');
    if v_code is null or v_code not in (
      'reason_mutual',
      'reason_schedule',
      'reason_pay',
      'reason_vehicle',
      'reason_personal',
      'reason_other'
    ) then
      raise exception 'invalid_reason_code';
    end if;
  end if;

  insert into public.driver_employment_requests (
    car_id,
    driver_id,
    owner_id,
    kind,
    reason_code,
    reason_note
  )
  values (
    p_car_id,
    v_driver,
    v_owner,
    p_kind,
    v_code,
    v_note
  )
  returning id into v_id;

  insert into public.user_notifications (user_id, kind, payload)
  values (
    v_owner,
    'driver_employment_request_new',
    jsonb_build_object(
      'request_id', v_id,
      'car_id', p_car_id,
      'plate', v_plate,
      'kind', p_kind,
      'driver_id', v_driver
    )
  );

  return v_id;
end;
$$;

revoke all on function public.driver_submit_employment_request(uuid, text, text, text) from public;
grant execute on function public.driver_submit_employment_request(uuid, text, text, text) to authenticated;

-- Driver: cancel own pending request
create or replace function public.driver_cancel_employment_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.driver_employment_requests r
  set
    status = 'cancelled_by_driver',
    resolved_at = now()
  where r.id = p_request_id
    and r.driver_id = auth.uid()
    and r.status = 'pending_owner';

  if not found then
    raise exception 'cancel_failed';
  end if;
end;
$$;

revoke all on function public.driver_cancel_employment_request(uuid) from public;
grant execute on function public.driver_cancel_employment_request(uuid) to authenticated;

-- Owner: respond to request
create or replace function public.owner_respond_employment_request(p_request_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_car uuid;
  v_driver uuid;
  v_kind text;
  v_plate text;
begin
  if p_action is null
    or p_action not in ('confirm_release', 'reject_release', 'acknowledge_intent') then
    raise exception 'invalid_action';
  end if;

  select r.car_id, r.driver_id, r.kind, coalesce(c.plate_number::text, '')
    into v_car, v_driver, v_kind, v_plate
  from public.driver_employment_requests r
  inner join public.cars c on c.id = r.car_id
  where r.id = p_request_id
    and r.owner_id = v_owner
    and r.status = 'pending_owner'
  for update;

  if not found then
    raise exception 'request_not_pending';
  end if;

  if v_kind = 'change_vehicle_intent' then
    if p_action = 'acknowledge_intent' then
      update public.driver_employment_requests
      set status = 'completed', resolved_at = now()
      where id = p_request_id;

      insert into public.user_notifications (user_id, kind, payload)
      values (
        v_driver,
        'driver_employment_intent_acknowledged',
        jsonb_build_object('request_id', p_request_id, 'car_id', v_car, 'plate', v_plate)
      );
      return;
    elsif p_action = 'reject_release' then
      update public.driver_employment_requests
      set status = 'rejected_by_owner', resolved_at = now()
      where id = p_request_id;

      insert into public.user_notifications (user_id, kind, payload)
      values (
        v_driver,
        'driver_employment_request_rejected',
        jsonb_build_object('request_id', p_request_id, 'car_id', v_car, 'plate', v_plate)
      );
      return;
    else
      raise exception 'invalid_action_for_intent';
    end if;
  end if;

  -- terminate
  if p_action = 'confirm_release' then
    update public.cars
    set
      driver_id = null,
      updated_at = now()
    where id = v_car
      and owner_id = v_owner
      and driver_id = v_driver;

    if not found then
      raise exception 'car_release_failed';
    end if;

    update public.driver_employment_requests
    set status = 'completed', resolved_at = now()
    where id = p_request_id;

    insert into public.user_notifications (user_id, kind, payload)
    values (
      v_driver,
      'driver_employment_released',
      jsonb_build_object('request_id', p_request_id, 'car_id', v_car, 'plate', v_plate)
    );
    return;
  end if;

  if p_action = 'reject_release' then
    update public.driver_employment_requests
    set status = 'rejected_by_owner', resolved_at = now()
    where id = p_request_id;

    insert into public.user_notifications (user_id, kind, payload)
    values (
      v_driver,
      'driver_employment_request_rejected',
      jsonb_build_object('request_id', p_request_id, 'car_id', v_car, 'plate', v_plate)
    );
    return;
  end if;

  raise exception 'invalid_action_for_terminate';
end;
$$;

revoke all on function public.owner_respond_employment_request(uuid, text) from public;
grant execute on function public.owner_respond_employment_request(uuid, text) to authenticated;
