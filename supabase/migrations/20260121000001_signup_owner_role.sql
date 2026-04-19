-- Krok 2: migracja admin → owner, is_admin(), handle_new_user() z signup_role.

update public.profiles
set role = 'owner'::public.user_role
where role = 'admin'::public.user_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin'::public.user_role, 'owner'::public.user_role)
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  r := lower(trim(coalesce(new.raw_user_meta_data->>'signup_role', 'driver')));
  if r not in ('owner', 'driver') then
    r := 'driver';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    r::public.user_role
  );
  return new;
end;
$$;
