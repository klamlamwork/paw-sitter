alter table public.sitter_services
  add column if not exists extra_pet_rate numeric(10,2) not null default 0,
  add column if not exists rate_60min numeric(10,2) not null default 0;

alter table public.bookings
  add column if not exists price_breakdown jsonb;

notify pgrst, 'reload schema';
