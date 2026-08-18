alter table public.bookings
  add column if not exists stripe_session_id text;

create index if not exists bookings_stripe_session_idx
  on public.bookings (stripe_session_id);

notify pgrst, 'reload schema';
