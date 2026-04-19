-- OC/AC merged into insurance (app table is public.cars, not vehicles).
alter table public.cars
  add column if not exists insurance_expiry date,
  add column if not exists insurance_cost numeric(12, 2) not null default 0;

update public.cars
set insurance_expiry = case
  when oc_expiry is not null and ac_expiry is not null then least(oc_expiry::date, ac_expiry::date)
  else coalesce(oc_expiry::date, ac_expiry::date)
end
where (oc_expiry is not null or ac_expiry is not null);

update public.cars
set insurance_cost = coalesce(oc_cost, 0) + coalesce(ac_cost, 0);

-- Expanded driver profile
alter table public.profiles
  add column if not exists gender text,
  add column if not exists birth_year integer,
  add column if not exists poland_status text,
  add column if not exists poland_status_doc_url text,
  add column if not exists avatar_url text;

-- Storage buckets
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('profile-docs', 'profile-docs', false)
on conflict (id) do update set public = excluded.public;

-- --- Avatars: public read; users upload only under own user-id folder ---
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- --- Profile docs: private; driver owns prefix; fleet owner read after accepted application ---
drop policy if exists "profile_docs_insert_own" on storage.objects;
create policy "profile_docs_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "profile_docs_select_own" on storage.objects;
create policy "profile_docs_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'profile-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "profile_docs_update_own" on storage.objects;
create policy "profile_docs_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "profile_docs_delete_own" on storage.objects;
create policy "profile_docs_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "profile_docs_select_owner_accepted" on storage.objects;
create policy "profile_docs_select_owner_accepted"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'profile-docs'
    and exists (
      select 1
      from public.driver_applications da
      where da.status = 'accepted'
        and da.driver_id::text = split_part(storage.objects.name, '/', 1)
        and da.owner_id = auth.uid()
    )
  );
