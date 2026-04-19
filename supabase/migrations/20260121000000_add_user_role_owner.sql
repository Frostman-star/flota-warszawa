-- Krok 1: dodaj etykietę enum „owner” (osobna migracja = commit przed użyciem wartości).

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'user_role'
      and e.enumlabel = 'owner'
  ) then
    alter type public.user_role add value 'owner';
  end if;
end $$;
