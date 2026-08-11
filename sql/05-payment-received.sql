-- Payment confirmation on bookings
alter table public.bookings
  add column if not exists payment_received boolean not null default false;

alter table public.bookings
  add column if not exists payment_received_at timestamptz;
