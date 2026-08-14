-- Sitter bookings: Stripe auth/capture, 10% platform fee, payouts

alter table public.bookings
  add column if not exists payment_method text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists stripe_payment_intent text,
  add column if not exists stripe_payout_id text,
  add column if not exists platform_fee_cents integer,
  add column if not exists sitter_payout_cents integer,
  add column if not exists captured_at timestamptz,
  add column if not exists payout_status text;

create index if not exists bookings_payment_status_idx
  on public.bookings (payment_status);

create index if not exists bookings_stripe_pi_idx
  on public.bookings (stripe_payment_intent);

-- Admin setting to enable/disable Stripe for pet sitting
create table if not exists public.sitter_payments (
  id uuid primary key default gen_random_uuid(),
  stripe_enabled boolean not null default false,
  platform_fee_pct numeric(4,2) not null default 10.00,
  updated_at timestamptz not null default now()
);

insert into public.sitter_payments (id, stripe_enabled, platform_fee_pct, updated_at)
values
  (gen_random_uuid(), false, 10.00, now())
on conflict do nothing;

notify pgrst, 'reload schema';
