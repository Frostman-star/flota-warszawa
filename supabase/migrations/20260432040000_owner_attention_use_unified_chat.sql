-- Switch owner attention RPCs from legacy application_chat_messages
-- to unified chat_threads/chat_messages.

create or replace function public.owner_fleet_car_attention_counts(p_car_ids uuid[])
returns table (
  car_id uuid,
  pending_apps bigint,
  pending_employment bigint,
  chat_attention bigint,
  chat_first_app_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select unnest(p_car_ids) as car_id
  ),
  apps as (
    select da.car_id, count(*)::bigint as n
    from public.driver_applications da
    where da.owner_id = auth.uid()
      and da.status = 'pending'
      and da.car_id = any(p_car_ids)
    group by da.car_id
  ),
  emp as (
    select r.car_id, count(*)::bigint as n
    from public.driver_employment_requests r
    where r.owner_id = auth.uid()
      and r.status = 'pending_owner'
      and r.car_id = any(p_car_ids)
    group by r.car_id
  ),
  last_app_chat_message as (
    select distinct on (t.application_id)
      t.application_id,
      m.sender_id,
      m.created_at
    from public.chat_threads t
    join public.chat_messages m on m.thread_id = t.id
    where t.thread_type = 'application'
      and t.application_id is not null
    order by t.application_id, m.created_at desc
  ),
  chat_candidates as (
    select da.car_id, da.id as application_id, da.created_at
    from public.driver_applications da
    join last_app_chat_message l on l.application_id = da.id
    where da.owner_id = auth.uid()
      and da.status = 'pending'
      and da.car_id = any(p_car_ids)
      and l.sender_id = da.driver_id
  ),
  chat_agg as (
    select
      cc.car_id,
      count(*)::bigint as n,
      (array_agg(cc.application_id order by cc.created_at asc))[1] as first_id
    from chat_candidates cc
    group by cc.car_id
  )
  select
    b.car_id,
    coalesce(a.n, 0)::bigint,
    coalesce(e.n, 0)::bigint,
    coalesce(c.n, 0)::bigint,
    c.first_id
  from base b
  left join apps a on a.car_id = b.car_id
  left join emp e on e.car_id = b.car_id
  left join chat_agg c on c.car_id = b.car_id;
$$;

revoke all on function public.owner_fleet_car_attention_counts(uuid[]) from public;
grant execute on function public.owner_fleet_car_attention_counts(uuid[]) to authenticated;

create or replace function public.owner_application_ids_needing_owner_reply_for_car(p_car_id uuid)
returns table (application_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with last_app_chat_message as (
    select distinct on (t.application_id)
      t.application_id,
      m.sender_id,
      m.created_at
    from public.chat_threads t
    join public.chat_messages m on m.thread_id = t.id
    where t.thread_type = 'application'
      and t.application_id is not null
    order by t.application_id, m.created_at desc
  )
  select da.id
  from public.driver_applications da
  join last_app_chat_message l on l.application_id = da.id
  where da.owner_id = auth.uid()
    and da.car_id = p_car_id
    and da.status = 'pending'
    and l.sender_id = da.driver_id
  order by da.created_at asc;
$$;

revoke all on function public.owner_application_ids_needing_owner_reply_for_car(uuid) from public;
grant execute on function public.owner_application_ids_needing_owner_reply_for_car(uuid) to authenticated;
