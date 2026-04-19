-- Monthly cost fields for fleet analytics (app table: public.cars, not vehicles).
alter table public.cars
  add column if not exists oc_cost numeric(12, 2) not null default 0,
  add column if not exists ac_cost numeric(12, 2) not null default 0,
  add column if not exists service_cost numeric(12, 2) not null default 0,
  add column if not exists other_costs numeric(12, 2) not null default 0;
