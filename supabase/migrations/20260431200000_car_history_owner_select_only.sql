-- Drivers no longer read car_history (private fleet activity). Owners retain full access.

drop policy if exists "car_history_driver_select" on public.car_history;
