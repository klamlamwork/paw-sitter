-- Booking address + service type revamp

alter table public.bookings
  add column if not exists service_address text,
  add column if not exists service_address_lat numeric(9,6),
  add column if not exists service_address_lng numeric(9,6),
  add column if not exists service_address_city text,
  add column if not exists service_address_state text,
  add column if not exists service_address_postal_code text,
  add column if not exists service_address_country text;

create index if not exists bookings_service_address_city_idx on public.bookings (service_address_city);

notify pgrst, 'reload schema';
