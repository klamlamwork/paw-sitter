-- Ensure radius_km exists and refresh API schema cache
alter table public.sitter_services
  add column if not exists radius_km numeric(6,1) not null default 15;

alter table public.sitters
  add column if not exists phone text;

notify pgrst, 'reload schema';
