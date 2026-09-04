alter table public.shop_product_reviews
  add column if not exists verified_purchase boolean not null default true;

update public.shop_product_reviews r
set verified_purchase = false
from public.shop_order_items i
where r.order_item_id = i.id
  and coalesce(i.refunded_qty, 0) >= coalesce(i.qty, 0);

notify pgrst, 'reload schema';
