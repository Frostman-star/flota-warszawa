-- Idempotent repair: RLS on cars uses public.is_admin(). It must treat both
-- legacy 'admin' and 'owner' as fleet managers (same as app + schema.sql).

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
