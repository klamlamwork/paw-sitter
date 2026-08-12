-- Allow unlimited radius (null = anywhere)
alter table public.sitter_services
  alter column radius_km drop not null;

alter table public.sitter_services
  alter column radius_km drop default;

notify pgrst, 'reload schema';
