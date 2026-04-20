-- Lead attribution on driver applications + in-app chat per application.

-- 1) lead_source: where the contact originated (marketplace vs future entry points)
alter table public.driver_applications
  add column if not exists lead_source text;

update public.driver_applications
set lead_source = 'cario_marketplace'
where lead_source is null;

alter table public.driver_applications
  alter column lead_source set default 'cario_marketplace',
  alter column lead_source set not null;

alter table public.driver_applications
  drop constraint if exists driver_applications_lead_source_chk;

alter table public.driver_applications
  add constraint driver_applications_lead_source_chk
  check (
    lead_source in (
      'cario_marketplace',
      'cario_fleet_profile',
      'cario_direct',
      'unknown'
    )
  );

-- 2) Chat messages (thread = one driver_applications row)
create table if not exists public.application_chat_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.driver_applications (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint application_chat_messages_body_chk check (
    char_length(trim(body)) > 0
    and char_length(body) <= 4000
  )
);

create index if not exists application_chat_messages_app_created_idx
  on public.application_chat_messages (application_id, created_at);

alter table public.application_chat_messages enable row level security;

drop policy if exists application_chat_messages_select_participants
  on public.application_chat_messages;

create policy application_chat_messages_select_participants
  on public.application_chat_messages for select
  using (
    exists (
      select 1
      from public.driver_applications da
      where da.id = application_id
        and (da.driver_id = auth.uid() or da.owner_id = auth.uid())
    )
  );

drop policy if exists application_chat_messages_insert_participants
  on public.application_chat_messages;

create policy application_chat_messages_insert_participants
  on public.application_chat_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.driver_applications da
      where da.id = application_id
        and (da.driver_id = auth.uid() or da.owner_id = auth.uid())
        and da.status in ('pending', 'accepted')
    )
  );

grant select, insert on public.application_chat_messages to authenticated;

-- Realtime (Supabase): enable live updates in the app. If this errors because the table is already
-- in the publication, the migration can be adjusted manually in SQL Editor.
alter publication supabase_realtime add table public.application_chat_messages;
