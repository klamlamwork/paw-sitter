alter table public.bookings
  add column if not exists service_fee_cents integer not null default 0,
  add column if not exists customer_total_cents integer;

comment on column public.bookings.service_fee_cents is 'Paw Service Fee (10% of sitter subtotal) charged to customer; not paid to sitter';
comment on column public.bookings.sitter_payout_cents is 'Agreed sitter rate; not reduced by points or the Paw Service Fee';
comment on column public.bookings.platform_fee_cents is 'Fee kept by platform (application_fee_amount)';

notify pgrst, 'reload schema';
