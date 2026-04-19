-- Public fleet profile fields + public endpoint for /flota/:ownerId.

alter table public.profiles
  add column if not exists company_name text,
  add column if not exists company_logo_url text,
  add column if not exists company_description text,
  add column if not exists company_phone text,
  add column if not exists company_location text default 'Warszawa';

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "company_logos_public_read" on storage.objects;
create policy "company_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'company-logos');

drop policy if exists "company_logos_insert_own" on storage.objects;
create policy "company_logos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company-logos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "company_logos_update_own" on storage.objects;
create policy "company_logos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'company-logos'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'company-logos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "company_logos_delete_own" on storage.objects;
create policy "company_logos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'company-logos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists cars_marketplace_select on public.cars;
drop policy if exists "marketplace listings visible to all" on public.cars;
create policy "marketplace listings visible to all"
  on public.cars for select
  using (
    marketplace_listed = true
    or owner_id = auth.uid()
  );

create or replace function public.get_public_fleet_profile(p_owner_id uuid)
returns table (
  id uuid,
  company_name text,
  company_logo_url text,
  company_description text,
  company_phone text,
  company_location text,
  fleet_size bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(trim(p.company_name), ''), nullif(trim(p.full_name), ''), 'Cario') as company_name,
    p.company_logo_url,
    p.company_description,
    p.company_phone,
    coalesce(nullif(trim(p.company_location), ''), 'Warszawa') as company_location,
    (select count(*) from public.cars c where c.owner_id = p.id) as fleet_size
  from public.profiles p
  where p.id = p_owner_id
    and p.role in ('owner'::public.user_role, 'admin'::public.user_role)
  limit 1;
$$;

grant execute on function public.get_public_fleet_profile(uuid) to anon, authenticated;
