-- Driver finance MVP: incomes, expenses, monthly goals.

create table if not exists public.driver_income_entries (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users (id) on delete cascade,
  car_id uuid references public.cars (id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'other',
  happened_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  constraint driver_income_entries_category_chk check (
    category in ('rides', 'tips', 'bonus', 'other')
  )
);

create table if not exists public.driver_expense_entries (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users (id) on delete cascade,
  car_id uuid references public.cars (id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'other',
  happened_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  constraint driver_expense_entries_category_chk check (
    category in ('fuel', 'wash', 'service', 'fees', 'fines', 'other')
  )
);

create table if not exists public.driver_finance_goals (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users (id) on delete cascade,
  period_key text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  created_at timestamptz not null default now(),
  constraint driver_finance_goals_period_key_chk check (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint driver_finance_goals_driver_period_uq unique (driver_id, period_key)
);

create index if not exists driver_income_entries_driver_happened_idx
  on public.driver_income_entries (driver_id, happened_on desc);
create index if not exists driver_expense_entries_driver_happened_idx
  on public.driver_expense_entries (driver_id, happened_on desc);
create index if not exists driver_finance_goals_driver_period_idx
  on public.driver_finance_goals (driver_id, period_key);

alter table public.driver_income_entries enable row level security;
alter table public.driver_expense_entries enable row level security;
alter table public.driver_finance_goals enable row level security;

drop policy if exists driver_income_entries_own on public.driver_income_entries;
create policy driver_income_entries_own
  on public.driver_income_entries
  for all
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

drop policy if exists driver_expense_entries_own on public.driver_expense_entries;
create policy driver_expense_entries_own
  on public.driver_expense_entries
  for all
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

drop policy if exists driver_finance_goals_own on public.driver_finance_goals;
create policy driver_finance_goals_own
  on public.driver_finance_goals
  for all
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

grant select, insert, update, delete on public.driver_income_entries to authenticated;
grant select, insert, update, delete on public.driver_expense_entries to authenticated;
grant select, insert, update, delete on public.driver_finance_goals to authenticated;
