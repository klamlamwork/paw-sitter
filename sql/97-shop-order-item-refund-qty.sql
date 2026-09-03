-- Partial quantity refunds on shop_order_items.
-- Run after sql/96-shop-order-item-refunds.sql.

alter table public.shop_order_items
  add column if not exists refunded_qty int not null default 0;

notify pgrst, 'reload schema';
