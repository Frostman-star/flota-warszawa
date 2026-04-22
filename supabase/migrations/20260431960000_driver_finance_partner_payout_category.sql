-- Add partner payout schedule fee as an expense category (e.g. taxi partner app weekly vs daily payout).

alter table public.driver_expense_entries
  drop constraint if exists driver_expense_entries_category_chk;

alter table public.driver_expense_entries
  add constraint driver_expense_entries_category_chk check (
    category in ('fuel', 'wash', 'service', 'fees', 'fines', 'rent', 'partner_payout', 'other')
  );
