-- Unified chat (safe rollout): schema + RLS + backfill + RPC.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'chat_thread_type') then
    create type public.chat_thread_type as enum ('direct', 'application');
  end if;
end $$;

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  thread_type public.chat_thread_type not null,
  application_id uuid references public.driver_applications (id) on delete cascade,
  direct_user_a uuid references public.profiles (id) on delete cascade,
  direct_user_b uuid references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_threads_direct_pair_chk check (
    (thread_type = 'direct' and direct_user_a is not null and direct_user_b is not null and application_id is null and direct_user_a <> direct_user_b)
    or (thread_type = 'application' and application_id is not null and direct_user_a is null and direct_user_b is null)
  )
);

create unique index if not exists chat_threads_application_unique
  on public.chat_threads (application_id)
  where thread_type = 'application';

create unique index if not exists chat_threads_direct_pair_unique
  on public.chat_threads (direct_user_a, direct_user_b)
  where thread_type = 'direct';

create index if not exists chat_threads_updated_idx
  on public.chat_threads (updated_at desc);

create table if not exists public.chat_thread_participants (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (thread_id, user_id)
);

create index if not exists chat_thread_participants_user_idx
  on public.chat_thread_participants (user_id, created_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_body_len check (char_length(trim(body)) between 1 and 4000)
);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at);

create or replace function public.chat_touch_thread_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_touch_thread_updated on public.chat_messages;
create trigger chat_messages_touch_thread_updated
  after insert on public.chat_messages
  for each row execute function public.chat_touch_thread_updated();

drop trigger if exists chat_threads_set_updated_at on public.chat_threads;
create trigger chat_threads_set_updated_at
  before update on public.chat_threads
  for each row execute function public.set_updated_at();

alter table public.chat_threads enable row level security;
alter table public.chat_thread_participants enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists chat_threads_select_member on public.chat_threads;
drop policy if exists chat_threads_insert_member on public.chat_threads;
drop policy if exists chat_threads_update_admin on public.chat_threads;

create policy chat_threads_select_member
  on public.chat_threads for select
  using (
    exists (
      select 1
      from public.chat_thread_participants p
      where p.thread_id = chat_threads.id
        and p.user_id = auth.uid()
    )
  );

create policy chat_threads_update_admin
  on public.chat_threads for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists chat_thread_participants_select_member on public.chat_thread_participants;
drop policy if exists chat_thread_participants_update_self on public.chat_thread_participants;

create policy chat_thread_participants_select_member
  on public.chat_thread_participants for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.chat_thread_participants p2
      where p2.thread_id = chat_thread_participants.thread_id
        and p2.user_id = auth.uid()
    )
  );

create policy chat_thread_participants_update_self
  on public.chat_thread_participants for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists chat_messages_select_member on public.chat_messages;
drop policy if exists chat_messages_insert_member on public.chat_messages;

create policy chat_messages_select_member
  on public.chat_messages for select
  using (
    exists (
      select 1
      from public.chat_thread_participants p
      where p.thread_id = chat_messages.thread_id
        and p.user_id = auth.uid()
    )
  );

create policy chat_messages_insert_member
  on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.chat_thread_participants p
      where p.thread_id = chat_messages.thread_id
        and p.user_id = auth.uid()
    )
  );

create or replace function public.chat_ensure_application_thread(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
  v_driver_id uuid;
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select da.driver_id, da.owner_id
    into v_driver_id, v_owner_id
  from public.driver_applications da
  where da.id = p_application_id;

  if v_driver_id is null or v_owner_id is null then
    raise exception 'application_not_found';
  end if;

  if auth.uid() <> v_driver_id and auth.uid() <> v_owner_id then
    raise exception 'forbidden';
  end if;

  select id
    into v_thread_id
  from public.chat_threads
  where thread_type = 'application'
    and application_id = p_application_id
  limit 1;

  if v_thread_id is null then
    insert into public.chat_threads (thread_type, application_id, created_by)
    values ('application', p_application_id, auth.uid())
    returning id into v_thread_id;

    insert into public.chat_thread_participants (thread_id, user_id)
    values (v_thread_id, v_driver_id)
    on conflict do nothing;

    insert into public.chat_thread_participants (thread_id, user_id)
    values (v_thread_id, v_owner_id)
    on conflict do nothing;
  end if;

  return v_thread_id;
end;
$$;

create or replace function public.chat_get_or_create_direct_thread(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_a uuid;
  v_b uuid;
  v_thread_id uuid;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'unauthorized';
  end if;
  if p_other_user_id is null or p_other_user_id = v_me then
    raise exception 'invalid_participant';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_other_user_id) then
    raise exception 'user_not_found';
  end if;

  if v_me::text < p_other_user_id::text then
    v_a := v_me;
    v_b := p_other_user_id;
  else
    v_a := p_other_user_id;
    v_b := v_me;
  end if;

  select id
    into v_thread_id
  from public.chat_threads
  where thread_type = 'direct'
    and direct_user_a = v_a
    and direct_user_b = v_b
  limit 1;

  if v_thread_id is null then
    insert into public.chat_threads (thread_type, direct_user_a, direct_user_b, created_by)
    values ('direct', v_a, v_b, v_me)
    returning id into v_thread_id;

    insert into public.chat_thread_participants (thread_id, user_id)
    values (v_thread_id, v_a)
    on conflict do nothing;

    insert into public.chat_thread_participants (thread_id, user_id)
    values (v_thread_id, v_b)
    on conflict do nothing;
  end if;

  return v_thread_id;
end;
$$;

create or replace function public.chat_inbox()
returns table (
  thread_id uuid,
  thread_type public.chat_thread_type,
  updated_at timestamptz,
  last_message_body text,
  last_message_at timestamptz,
  peer_user_id uuid,
  peer_full_name text,
  peer_role public.user_role,
  unread_count bigint,
  application_id uuid
)
language sql
security definer
set search_path = public
as $$
  with my_threads as (
    select
      t.id,
      t.thread_type,
      t.updated_at,
      t.application_id,
      me.last_seen_at
    from public.chat_threads t
    join public.chat_thread_participants me
      on me.thread_id = t.id
    where me.user_id = auth.uid()
  ),
  last_msg as (
    select distinct on (m.thread_id)
      m.thread_id,
      m.body,
      m.created_at
    from public.chat_messages m
    order by m.thread_id, m.created_at desc
  ),
  peer as (
    select
      p.thread_id,
      p.user_id,
      pr.full_name,
      pr.role
    from public.chat_thread_participants p
    join public.profiles pr on pr.id = p.user_id
    where p.user_id <> auth.uid()
  ),
  unread as (
    select
      mt.id as thread_id,
      count(*)::bigint as unread_count
    from my_threads mt
    join public.chat_messages m on m.thread_id = mt.id
    where (mt.last_seen_at is null or m.created_at > mt.last_seen_at)
      and m.sender_id <> auth.uid()
    group by mt.id
  )
  select
    mt.id as thread_id,
    mt.thread_type,
    mt.updated_at,
    lm.body as last_message_body,
    lm.created_at as last_message_at,
    peer.user_id as peer_user_id,
    peer.full_name as peer_full_name,
    peer.role as peer_role,
    coalesce(unread.unread_count, 0) as unread_count,
    mt.application_id
  from my_threads mt
  left join last_msg lm on lm.thread_id = mt.id
  left join peer on peer.thread_id = mt.id
  left join unread on unread.thread_id = mt.id
  order by coalesce(lm.created_at, mt.updated_at) desc;
$$;

revoke all on function public.chat_ensure_application_thread(uuid) from public;
grant execute on function public.chat_ensure_application_thread(uuid) to authenticated;
revoke all on function public.chat_get_or_create_direct_thread(uuid) from public;
grant execute on function public.chat_get_or_create_direct_thread(uuid) to authenticated;
revoke all on function public.chat_inbox() from public;
grant execute on function public.chat_inbox() to authenticated;

create or replace function public.get_service_chat_user_id(p_service_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select sp.id
  from public.service_profiles sp
  where sp.service_id = p_service_id
  limit 1;
$$;

revoke all on function public.get_service_chat_user_id(uuid) from public;
grant execute on function public.get_service_chat_user_id(uuid) to authenticated;

-- Backfill application threads and messages from legacy chat.
insert into public.chat_threads (thread_type, application_id, created_by, created_at, updated_at)
select
  'application',
  da.id,
  da.owner_id,
  da.created_at,
  coalesce(max(acm.created_at), da.updated_at, da.created_at)
from public.driver_applications da
left join public.application_chat_messages acm on acm.application_id = da.id
where not exists (
  select 1
  from public.chat_threads t
  where t.thread_type = 'application'
    and t.application_id = da.id
)
group by da.id, da.owner_id, da.created_at, da.updated_at;

insert into public.chat_thread_participants (thread_id, user_id, created_at)
select t.id, da.driver_id, now()
from public.chat_threads t
join public.driver_applications da on da.id = t.application_id
where t.thread_type = 'application'
on conflict do nothing;

insert into public.chat_thread_participants (thread_id, user_id, created_at)
select t.id, da.owner_id, now()
from public.chat_threads t
join public.driver_applications da on da.id = t.application_id
where t.thread_type = 'application'
on conflict do nothing;

insert into public.chat_messages (id, thread_id, sender_id, body, created_at)
select
  acm.id,
  t.id,
  acm.sender_id,
  acm.body,
  acm.created_at
from public.application_chat_messages acm
join public.chat_threads t
  on t.thread_type = 'application'
 and t.application_id = acm.application_id
where not exists (
  select 1 from public.chat_messages m where m.id = acm.id
);

-- Compatibility read-only view for legacy support during rollout.
create or replace view public.v_application_chat_messages_unified as
select
  t.application_id,
  m.id,
  m.sender_id,
  m.body,
  m.created_at
from public.chat_messages m
join public.chat_threads t on t.id = m.thread_id
where t.thread_type = 'application'
  and t.application_id is not null;
