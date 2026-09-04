do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.paw_point_ledger'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* 'reason'
      and pg_get_constraintdef(oid) not ilike '%earn_kol%'
  loop
    execute format('alter table public.paw_point_ledger drop constraint %I', r.conname);
  end loop;
end $$;

notify pgrst, 'reload schema';
