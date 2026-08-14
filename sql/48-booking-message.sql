-- Booking message + pets selection

alter table public.bookings
  add column if not exists customer_message text;

notify pgrst, 'reload schema';
