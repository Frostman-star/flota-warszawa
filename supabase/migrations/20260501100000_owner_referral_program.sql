-- Owner referral program + starter subscription fields.

alter table public.profiles
  add column if not exists plan_tier text not null default 'free',
  add column if not exists plan_expires_at date,
  add column if not exists pro_bonus_months int not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_plan_tier_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_plan_tier_check check (plan_tier in ('free', 'start', 'pro'));
  end if;
end $$;

create table if not exists public.owner_referral_codes (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  referral_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.owner_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_owner_id uuid not null references public.profiles (id) on delete cascade,
  referred_owner_id uuid not null unique references public.profiles (id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'rewarded', 'rejected')),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.owner_pro_rewards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  referral_id uuid unique references public.owner_referrals (id) on delete set null,
  months int not null default 1 check (months > 0),
  reason text not null default 'owner_referral',
  created_at timestamptz not null default now()
);

create index if not exists owner_referrals_referrer_idx on public.owner_referrals (referrer_owner_id);
create index if not exists owner_referrals_referred_idx on public.owner_referrals (referred_owner_id);
create index if not exists owner_pro_rewards_owner_idx on public.owner_pro_rewards (owner_id);

alter table public.owner_referral_codes enable row level security;
alter table public.owner_referrals enable row level security;
alter table public.owner_pro_rewards enable row level security;

drop policy if exists owner_referral_codes_select_own on public.owner_referral_codes;
create policy owner_referral_codes_select_own
  on public.owner_referral_codes for select
  using (owner_id = auth.uid());

drop policy if exists owner_referral_codes_insert_own on public.owner_referral_codes;
create policy owner_referral_codes_insert_own
  on public.owner_referral_codes for insert
  with check (owner_id = auth.uid());

drop policy if exists owner_referral_codes_update_own on public.owner_referral_codes;
create policy owner_referral_codes_update_own
  on public.owner_referral_codes for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists owner_referrals_select_related on public.owner_referrals;
create policy owner_referrals_select_related
  on public.owner_referrals for select
  using (referrer_owner_id = auth.uid() or referred_owner_id = auth.uid());

drop policy if exists owner_referrals_insert_referred on public.owner_referrals;
create policy owner_referrals_insert_referred
  on public.owner_referrals for insert
  with check (referred_owner_id = auth.uid());

drop policy if exists owner_referrals_update_related on public.owner_referrals;
create policy owner_referrals_update_related
  on public.owner_referrals for update
  using (referrer_owner_id = auth.uid() or referred_owner_id = auth.uid())
  with check (referrer_owner_id = auth.uid() or referred_owner_id = auth.uid());

drop policy if exists owner_pro_rewards_select_own on public.owner_pro_rewards;
create policy owner_pro_rewards_select_own
  on public.owner_pro_rewards for select
  using (owner_id = auth.uid());

drop policy if exists owner_pro_rewards_insert_own on public.owner_pro_rewards;
create policy owner_pro_rewards_insert_own
  on public.owner_pro_rewards for insert
  with check (owner_id = auth.uid());

create or replace function public.gen_owner_ref_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    exit when not exists (
      select 1
      from public.owner_referral_codes c
      where c.referral_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.ensure_owner_referral_code(p_owner_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code text;
begin
  select c.referral_code
  into existing_code
  from public.owner_referral_codes c
  where c.owner_id = p_owner_id;

  if existing_code is not null then
    return existing_code;
  end if;

  existing_code := public.gen_owner_ref_code();

  insert into public.owner_referral_codes (owner_id, referral_code)
  values (p_owner_id, existing_code)
  on conflict (owner_id) do update
    set referral_code = public.owner_referral_codes.referral_code
  returning referral_code into existing_code;

  return existing_code;
end;
$$;

-- Backfill codes for existing owners.
insert into public.owner_referral_codes (owner_id, referral_code)
select p.id, public.gen_owner_ref_code()
from public.profiles p
where p.role in ('owner'::public.user_role, 'admin'::public.user_role)
  and not exists (
    select 1
    from public.owner_referral_codes c
    where c.owner_id = p.id
  );

create or replace function public.claim_owner_referral(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  me_role public.user_role;
  referrer uuid;
begin
  if me is null then
    return 'unauthorized';
  end if;

  select p.role into me_role from public.profiles p where p.id = me;
  if me_role is null or me_role not in ('owner'::public.user_role, 'admin'::public.user_role) then
    return 'not_owner';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    return 'no_code';
  end if;

  select c.owner_id
  into referrer
  from public.owner_referral_codes c
  where c.referral_code = lower(trim(p_code));

  if referrer is null then
    return 'invalid_code';
  end if;

  if referrer = me then
    return 'self_referral';
  end if;

  if exists (select 1 from public.owner_referrals r where r.referred_owner_id = me) then
    return 'already_claimed';
  end if;

  insert into public.owner_referrals (referrer_owner_id, referred_owner_id, referral_code, status)
  values (referrer, me, lower(trim(p_code)), 'pending');

  return 'claimed';
end;
$$;

create or replace function public.qualify_my_owner_referral_if_paid()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_plan text;
  ref_row public.owner_referrals%rowtype;
begin
  if me is null then
    return 'unauthorized';
  end if;

  select p.plan_tier into my_plan from public.profiles p where p.id = me;
  if my_plan not in ('start', 'pro') then
    return 'plan_not_paid';
  end if;

  select r.*
  into ref_row
  from public.owner_referrals r
  where r.referred_owner_id = me
    and r.status = 'pending'
  limit 1;

  if ref_row.id is null then
    return 'no_pending_referral';
  end if;

  update public.owner_referrals
  set status = 'rewarded',
      qualified_at = now(),
      rewarded_at = now()
  where id = ref_row.id;

  insert into public.owner_pro_rewards (owner_id, referral_id, months, reason)
  values (ref_row.referrer_owner_id, ref_row.id, 1, 'owner_referral')
  on conflict (referral_id) do nothing;

  update public.profiles p
  set pro_bonus_months = coalesce(p.pro_bonus_months, 0) + 1,
      plan_expires_at = (
        (greatest(coalesce(p.plan_expires_at, current_date), current_date)::timestamp + interval '1 month')::date
      ),
      updated_at = now()
  where p.id = ref_row.referrer_owner_id;

  return 'rewarded';
end;
$$;

create or replace function public.set_my_owner_plan(p_tier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  me_role public.user_role;
  norm_tier text := lower(trim(coalesce(p_tier, 'free')));
begin
  if me is null then
    return 'unauthorized';
  end if;

  select p.role into me_role from public.profiles p where p.id = me;
  if me_role is null or me_role not in ('owner'::public.user_role, 'admin'::public.user_role) then
    return 'not_owner';
  end if;

  if norm_tier not in ('free', 'start', 'pro') then
    return 'invalid_tier';
  end if;

  update public.profiles p
  set plan_tier = norm_tier,
      plan_expires_at = case
        when norm_tier = 'free' then null
        when p.plan_expires_at is null or p.plan_expires_at < current_date then (current_date + interval '1 month')::date
        else p.plan_expires_at
      end,
      updated_at = now()
  where p.id = me;

  if norm_tier in ('start', 'pro') then
    perform public.qualify_my_owner_referral_if_paid();
  end if;

  return 'ok';
end;
$$;

create or replace function public.get_my_owner_referral_program()
returns table (
  referral_code text,
  pending_count int,
  rewarded_count int,
  bonus_months int,
  plan_tier text,
  plan_expires_at date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return;
  end if;

  return query
  select
    public.ensure_owner_referral_code(me) as referral_code,
    coalesce((select count(*)::int from public.owner_referrals r where r.referrer_owner_id = me and r.status = 'pending'), 0) as pending_count,
    coalesce((select count(*)::int from public.owner_referrals r where r.referrer_owner_id = me and r.status = 'rewarded'), 0) as rewarded_count,
    coalesce(p.pro_bonus_months, 0) as bonus_months,
    p.plan_tier,
    p.plan_expires_at
  from public.profiles p
  where p.id = me
  limit 1;
end;
$$;

grant execute on function public.claim_owner_referral(text) to authenticated;
grant execute on function public.get_my_owner_referral_program() to authenticated;
grant execute on function public.set_my_owner_plan(text) to authenticated;
grant execute on function public.qualify_my_owner_referral_if_paid() to authenticated;
