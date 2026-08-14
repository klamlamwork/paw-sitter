-- Allow admin to delete a shop that already has orders.
-- Keep order history: unlink seller_shop_id instead of blocking or cascading orders away.

alter table public.shop_orders
  add column if not exists seller_shop_name text default '';

update public.shop_orders o
set seller_shop_name = s.name
from public.shop_shops s
where o.seller_shop_id = s.id
  and (o.seller_shop_name is null or o.seller_shop_name = '');

alter table public.shop_orders
  alter column seller_shop_id drop not null;

alter table public.shop_order_items
  alter column seller_shop_id drop not null;

alter table public.shop_orders
  drop constraint if exists shop_orders_seller_shop_id_fkey;

alter table public.shop_orders
  add constraint shop_orders_seller_shop_id_fkey
  foreign key (seller_shop_id) references public.shop_shops (id) on delete set null;

alter table public.shop_order_items
  drop constraint if exists shop_order_items_seller_shop_id_fkey;

alter table public.shop_order_items
  add constraint shop_order_items_seller_shop_id_fkey
  foreign key (seller_shop_id) references public.shop_shops (id) on delete set null;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'shop_cart_items_shop_id_fkey'
  ) then
    alter table public.shop_cart_items drop constraint shop_cart_items_shop_id_fkey;
    alter table public.shop_cart_items
      add constraint shop_cart_items_shop_id_fkey
      foreign key (shop_id) references public.shop_shops (id) on delete cascade;
  end if;
end $$;

notify pgrst, 'reload schema';
