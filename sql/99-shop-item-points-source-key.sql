-- Item-level Paw Points refund idempotency keys.
-- Schema only: does not alter checkout, cart, Stripe webhooks, seller UI, or ledger behavior.
-- Run after sql/96-shop-order-item-refunds.sql, sql/97-shop-order-item-refund-qty.sql, and sql/98-shop-item-points-audit.sql.

alter table public.shop_order_item_point_awards
  add column if not exists qty int not null default 0;

alter table public.shop_order_item_point_awards
  drop constraint if exists shop_order_item_point_awards_qty_check;
alter table public.shop_order_item_point_awards
  add constraint shop_order_item_point_awards_qty_check
  check (qty >= 0);

alter table public.shop_order_item_refund_events
  add column if not exists source_key text;

update public.shop_order_item_refund_events
set source_key = 'legacy:' || id::text
where source_key is null or btrim(source_key) = '';

create unique index if not exists shop_order_item_refund_events_source_key_uidx
  on public.shop_order_item_refund_events (source_key);

alter table public.shop_order_item_refund_events
  alter column source_key set not null;

notify pgrst, 'reload schema';
