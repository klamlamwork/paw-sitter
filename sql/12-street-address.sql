alter table public.profiles
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists postal_code text;

alter table public.sitters
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists postal_code text;

notify pgrst, 'reload schema';
