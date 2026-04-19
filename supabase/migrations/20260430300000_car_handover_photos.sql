-- Car handover photo protocol (legal record). App table is public.cars — column car_id (not vehicles).
--
-- MANUAL BUCKET (Supabase Dashboard) if you prefer not to use SQL insert:
-- 1) Authentication is not required for this step — open your Supabase project.
-- 2) Storage → Create a new bucket → Name / ID: handover-photos
-- 3) Enable "Public bucket" so getPublicUrl() works for gallery thumbnails and downloads.
-- 4) Optional: set file size limit (e.g. 10 MB) and allow image/jpeg, image/png, image/webp.
-- 5) Policies: run from "storage.objects policies" below (public SELECT; authenticated INSERT/UPDATE/DELETE
--    only when the first path segment equals auth.uid(), matching uploads from the app).
--
create table if not exists public.car_handovers (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  driver_id uuid references public.profiles (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  handover_date timestamptz not null default now(),
  handover_type text not null default 'pickup' check (handover_type in ('pickup', 'return')),
  notes text,
  driver_name_snapshot text,
  created_at timestamptz not null default now()
);

create table if not exists public.handover_photos (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.car_handovers (id) on delete cascade,
  photo_url text not null,
  angle text not null,
  created_at timestamptz not null default now()
);

create index if not exists car_handovers_car_id_idx on public.car_handovers (car_id);
create index if not exists car_handovers_owner_id_idx on public.car_handovers (owner_id);
create index if not exists handover_photos_handover_id_idx on public.handover_photos (handover_id);

alter table public.car_handovers enable row level security;
alter table public.handover_photos enable row level security;

drop policy if exists "owner car handovers all" on public.car_handovers;
create policy "owner car handovers all"
  on public.car_handovers for all
  to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.cars c
      where c.id = car_id
        and c.owner_id = auth.uid()
    )
  );

drop policy if exists "owner handover photos all" on public.handover_photos;
create policy "owner handover photos all"
  on public.handover_photos for all
  to authenticated
  using (
    exists (
      select 1 from public.car_handovers h
      where h.id = handover_id
        and h.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.car_handovers h
      where h.id = handover_id
        and h.owner_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.car_handovers to authenticated;
grant select, insert, update, delete on public.handover_photos to authenticated;

-- --- Storage bucket (public read) ---
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'handover-photos',
  'handover-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {owner_id}/{car_id}/{handover_id}/{filename}.jpg — first folder must be auth.uid().
drop policy if exists "handover photos public read" on storage.objects;
create policy "handover photos public read"
  on storage.objects for select
  using (bucket_id = 'handover-photos');

drop policy if exists "handover photos owner insert" on storage.objects;
create policy "handover photos owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'handover-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "handover photos owner update" on storage.objects;
create policy "handover photos owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'handover-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'handover-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "handover photos owner delete" on storage.objects;
create policy "handover photos owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'handover-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );
