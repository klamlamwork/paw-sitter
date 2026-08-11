-- Location + timezone for profiles (customers) and sitters
alter table public.profiles
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists country_code text,
  add column if not exists timezone text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists location_id text;

alter table public.sitters
  add column if not exists timezone text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists location_id text;

alter table public.sitter_services
  add column if not exists radius_km numeric(6,1) not null default 15;

comment on column public.profiles.timezone is 'IANA timezone e.g. America/Vancouver';
comment on column public.sitters.timezone is 'IANA timezone of sitter base city';
comment on column public.sitter_services.radius_km is 'How far this service is offered from sitter base (km)';
