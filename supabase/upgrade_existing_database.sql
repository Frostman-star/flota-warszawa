-- Uruchom JEDEN RAZ w Supabase → SQL Editor, jeśli panel pokazuje błąd typu:
--   "column cars.driver_label does not exist"
-- lub inne brakujące kolumny / tabele (baza utworzona ze starszego schema.sql bez folderu migrations).

-- --- Z migrations/20250418000000_features.sql ---
alter table public.car_history
  add column if not exists service_type text,
  add column if not exists cost_pln numeric(12,2);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  alert_days int[] not null default array[30, 14, 7, 1]::int[],
  email_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  id smallint primary key default 1 check (id = 1),
  company_name text not null default 'Flota Warszawa',
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id, company_name)
values (1, 'Flota Warszawa')
on conflict (id) do nothing;

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  car_id uuid not null references public.cars (id) on delete cascade,
  doc_key text not null,
  threshold_days int not null,
  channel text not null check (channel in ('push', 'email')),
  sent_on date not null default (timezone('utc', now()))::date,
  unique (user_id, car_id, doc_key, threshold_days, channel, sent_on)
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.company_settings enable row level security;
alter table public.notification_log enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own
  on public.notification_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists company_settings_select on public.company_settings;
create policy company_settings_select
  on public.company_settings for select
  using (true);

drop policy if exists company_settings_update_admin on public.company_settings;
create policy company_settings_update_admin
  on public.company_settings for update
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select on public.company_settings to authenticated;
grant update on public.company_settings to authenticated;

-- --- Z migrations/20250419000000_simple_ux.sql ---
alter table public.cars
  add column if not exists driver_label text not null default '';

alter table public.cars
  add column if not exists show_in_marketplace boolean not null default false;

alter table public.cars
  add column if not exists marketplace_status text not null default 'zajete';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cars_marketplace_status_check'
  ) then
    alter table public.cars
      add constraint cars_marketplace_status_check
      check (marketplace_status in ('dostepne', 'zajete'));
  end if;
end $$;

alter table public.company_settings
  add column if not exists contact_email text;

drop policy if exists cars_marketplace_select on public.cars;
create policy cars_marketplace_select
  on public.cars for select
  to authenticated
  using (
    show_in_marketplace = true
    and marketplace_status = 'dostepne'
    and not public.is_admin()
  );
