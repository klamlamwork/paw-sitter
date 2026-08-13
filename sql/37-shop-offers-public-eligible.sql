-- Public can see all offers on approved products (eligible retailers)
-- Run after sql/21 (shop_product_offers)

drop policy if exists shop_product_offers_public_select on public.shop_product_offers;
create policy shop_product_offers_public_select on public.shop_product_offers
  for select using (
    public.is_admin()
    or public.is_shop_owner(shop_id)
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_offers.product_id
        and p.status = 'approved'
    )
  );

-- Ensure attached retailer offers are approved so they stay visible
update public.shop_product_offers o
set status = 'approved',
    updated_at = now()
where o.status is distinct from 'approved'
  and exists (
    select 1 from public.shop_products p
    where p.id = o.product_id and p.status = 'approved'
  );

notify pgrst, 'reload schema';
