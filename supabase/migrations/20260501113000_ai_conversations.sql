create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

drop policy if exists "users manage own conversations" on public.ai_conversations;
create policy "users manage own conversations"
  on public.ai_conversations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.set_ai_conversations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ai_conversations_updated_at on public.ai_conversations;
create trigger trg_ai_conversations_updated_at
before update on public.ai_conversations
for each row
execute function public.set_ai_conversations_updated_at();
