-- Per-car attention for fleet owner: pending marketplace applications, pending employment requests,
-- and "chat needs reply" (last message in application thread is from the driver).

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
  chat_candidates as (
    select da.car_id, da.id as application_id, da.created_at
    from public.driver_applications da
    where da.owner_id = auth.uid()
      and da.status = 'pending'
      and da.car_id = any(p_car_ids)
      and exists (select 1 from public.application_chat_messages m where m.application_id = da.id)
      and (
        select m.sender_id
        from public.application_chat_messages m
        where m.application_id = da.id
        order by m.created_at desc
        limit 1
      ) = da.driver_id
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

-- Pending applications on one car where the owner should reply in chat (last message is from the driver).
create or replace function public.owner_application_ids_needing_owner_reply_for_car(p_car_id uuid)
returns table (application_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select da.id
  from public.driver_applications da
  where da.owner_id = auth.uid()
    and da.car_id = p_car_id
    and da.status = 'pending'
    and exists (select 1 from public.application_chat_messages m where m.application_id = da.id)
    and (
      select m.sender_id
      from public.application_chat_messages m
      where m.application_id = da.id
      order by m.created_at desc
      limit 1
    ) = da.driver_id
  order by da.created_at asc;
$$;

revoke all on function public.owner_application_ids_needing_owner_reply_for_car(uuid) from public;
grant execute on function public.owner_application_ids_needing_owner_reply_for_car(uuid) to authenticated;
