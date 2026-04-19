-- Marketplace: allow any authenticated user to SELECT cars with marketplace_listed = true,
-- while fleet owners still only manage (and read) their own rows via owner_id.
-- App table is public.cars (this project does not use a "vehicles" table).

drop policy if exists "owners see own vehicles" on public.cars;
drop policy if exists cars_marketplace_select on public.cars;
drop policy if exists "marketplace listings visible to all" on public.cars;

create policy "marketplace listings visible to all"
  on public.cars
  for select
  to authenticated
  using (
    marketplace_listed = true
    or owner_id = auth.uid()
  );

drop policy if exists "owners insert own vehicles" on public.cars;
create policy "owners insert own vehicles"
  on public.cars
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "owners update own vehicles" on public.cars;
create policy "owners update own vehicles"
  on public.cars
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "owners delete own vehicles" on public.cars;
create policy "owners delete own vehicles"
  on public.cars
  for delete
  to authenticated
  using (owner_id = auth.uid());
