-- Extend driver expense category list with car rent.

alter table public.driver_expense_entries
  drop constraint if exists driver_expense_entries_category_chk;

alter table public.driver_expense_entries
  add constraint driver_expense_entries_category_chk check (
    category in ('fuel', 'wash', 'service', 'fees', 'fines', 'rent', 'other')
  );
