alter table public.pet_hygiene
  add column if not exists litter_brand text;

notify pgrst, 'reload schema';
