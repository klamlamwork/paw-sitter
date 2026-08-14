-- Booking slots revamp: one row per timeslot

alter table public.booking_slots
  add column if not exists service_type text,
  add column if not exists duration_minutes integer;

notify pgrst, 'reload schema';
