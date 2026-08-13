-- Let shop owners read and update orders for their shops.
-- Buyers keep insert + read of their own orders.

drop policy if exists shop_orders_owner on public.shop_orders;
drop policy if exists shop_orders_select on public.shop_orders;
drop policy if exists shop_orders_insert on public.shop_orders;
drop policy if exists shop_orders_update on public.shop_orders;

create policy shop_orders_select on public.shop_orders
  for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_shop_owner(seller_shop_id)
  );

create policy shop_orders_insert on public.shop_orders
  for insert
  with check (user_id = auth.uid() or public.is_admin());

create policy shop_orders_update on public.shop_orders
  for update
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_shop_owner(seller_shop_id)
  )
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_shop_owner(seller_shop_id)
  );

drop policy if exists shop_order_items_owner on public.shop_order_items;
drop policy if exists shop_order_items_select on public.shop_order_items;
drop policy if exists shop_order_items_insert on public.shop_order_items;

create policy shop_order_items_select on public.shop_order_items
  for select
  using (
    public.is_admin()
    or public.is_shop_owner(seller_shop_id)
    or exists (
      select 1 from public.shop_orders o
      where o.id = shop_order_items.order_id
        and o.user_id = auth.uid()
    )
  );

create policy shop_order_items_insert on public.shop_order_items
  for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.shop_orders o
      where o.id = shop_order_items.order_id
        and o.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
