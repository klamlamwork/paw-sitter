-- Per-item shop refunds. Run in Supabase SQL editor.
-- Does not change checkout, cart, or existing order status enums.

alter table public.shop_order_items
  add column if not exists refund_status text not null default 'none',
  add column if not exists refund_cents int not null default 0,
  add column if not exists stripe_refund_id text,
  add column if not exists refunded_at timestamptz;

alter table public.shop_order_items drop constraint if exists shop_order_items_refund_status_check;
alter table public.shop_order_items
  add constraint shop_order_items_refund_status_check
  check (refund_status in ('none', 'pending', 'refunded'));

notify pgrst, 'reload schema';
