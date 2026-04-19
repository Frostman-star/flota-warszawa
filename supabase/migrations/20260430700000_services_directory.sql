-- Service directory (Serwisy): listings and per-user reviews.

create table if not exists public.services (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null,
  address text not null,
  city text default 'Warszawa',
  phone text,
  google_maps_url text,
  description text,
  added_by uuid references auth.users (id),
  verified boolean default false,
  rating_sum integer default 0,
  rating_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.service_reviews (
  id uuid default gen_random_uuid() primary key,
  service_id uuid not null references public.services (id) on delete cascade,
  user_id uuid references auth.users (id),
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now(),
  unique (service_id, user_id)
);

alter table public.services enable row level security;
alter table public.service_reviews enable row level security;

drop policy if exists "everyone can read services" on public.services;
drop policy if exists "logged in users can add services" on public.services;

create policy "everyone can read services" on public.services for select using (true);

create policy "logged in users can add services" on public.services for insert
with check (
  auth.uid() is not null
  and added_by = auth.uid()
);

drop policy if exists "everyone can read reviews" on public.service_reviews;
drop policy if exists "logged in users can review" on public.service_reviews;
drop policy if exists "users can update own reviews" on public.service_reviews;

create policy "everyone can read reviews" on public.service_reviews for select using (true);

create policy "logged in users can review" on public.service_reviews for insert
with check (
  auth.uid() is not null
  and user_id = auth.uid()
);

create policy "users can update own reviews" on public.service_reviews for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Example data (Warszawa). Safe to re-run: skip if names already exist.
insert into public.services (name, category, address, city, phone, description, verified)
select v.name, v.category, v.address, v.city, v.phone, v.description, v.verified
from (
  values
    (
      'Auto Serwis Praga',
      '🔧 Mechanik ogólny',
      'ul. Targowa 15, Warszawa',
      'Warszawa',
      '+48221234567',
      'Specjalizacja: Toyota, Honda, hybrydy. Szybka diagnostyka.'::text,
      true
    ),
    (
      'Szyby Auto Wawa',
      '🪟 Szyby / Naprawa szyb',
      'ul. Marszałkowska 88, Warszawa',
      'Warszawa',
      '+48600111222',
      'Wymiana szyb, naprawa pęknięć, przyciemnianie.'::text,
      true
    ),
    (
      'Quick Oil Warszawa',
      '🛢️ Wymiana oleju',
      'ul. Puławska 200, Warszawa',
      'Warszawa',
      '+48229876543',
      'Wymiana oleju bez umówienia, czas 30 min.'::text,
      true
    ),
    (
      'Wulkanizacja 24h Modlińska',
      '🚗 Wulkanizacja / Opony',
      'ul. Modlińska 6, Warszawa',
      'Warszawa',
      '+48666333444',
      'Czynne całą dobę, montaż i wyważanie kół.'::text,
      false
    ),
    (
      'Lakiernia Premium Grochów',
      '🎨 Lakiernia / Blacharstwo',
      'ul. Grochowska 341, Warszawa',
      'Warszawa',
      '+48224567890',
      'Blacharstwo, lakierowanie, korekta lakieru, polerowanie.'::text,
      false
    )
) as v(name, category, address, city, phone, description, verified)
where not exists (
  select 1 from public.services s where s.name = v.name
);
