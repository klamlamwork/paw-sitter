alter table public.bookings
  add column if not exists booked_timezone text;

notify pgrst, 'reload schema';
