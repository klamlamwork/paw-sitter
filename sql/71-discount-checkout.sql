-- Checkout columns for redeemed promo codes.
-- Paste after 70-discount-system.sql.

alter table public.bookings
  add column if not exists discount_code text,
  add column if not exists discount_code_id uuid,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists discount_funded_by text;

alter table public.shop_orders
  add column if not exists discount_code text,
  add column if not exists discount_code_id uuid,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists discount_funded_by text;

alter table public.escrow_entries
  add column if not exists discount_cents integer not null default 0,
  add column if not exists discount_funded_by text,
  add column if not exists platform_absorbed_cents integer not null default 0;

notify pgrst, 'reload schema';
