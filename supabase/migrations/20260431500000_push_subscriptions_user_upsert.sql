create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade,
  subscription text not null,
  updated_at timestamptz default now(),
  endpoint text,
  p256dh text,
  auth text,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.push_subscriptions
  add column if not exists subscription text,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists endpoint text,
  add column if not exists p256dh text,
  add column if not exists auth text;

update public.push_subscriptions
set
  subscription = coalesce(
    subscription,
    jsonb_build_object(
      'endpoint',
      endpoint,
      'keys',
      jsonb_build_object('p256dh', p256dh, 'auth', auth)
    )::text
  ),
  updated_at = coalesce(updated_at, now())
where subscription is null;

alter table public.push_subscriptions
  alter column user_id set not null,
  alter column subscription set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_subscriptions_user_id_key'
      and conrelid = 'public.push_subscriptions'::regclass
  ) then
    alter table public.push_subscriptions add constraint push_subscriptions_user_id_key unique (user_id);
  end if;
end $$;

alter table public.push_subscriptions enable row level security;

drop policy if exists "users manage own subscriptions" on public.push_subscriptions;
create policy "users manage own subscriptions"
  on public.push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
