-- Break RLS cycle: shop_products <-> shop_product_offers
-- Public product reads must not query offers.
-- Offer reads must not query shop_products under RLS.

create or replace function public.product_is_public(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_products p
    where p.id = p_id
      and p.status = 'approved'
  );
$$;

revoke all on function public.product_is_public(uuid) from public;
grant execute on function public.product_is_public(uuid) to authenticated;
grant execute on function public.product_is_public(uuid) to anon;

-- Products: no subquery into shop_product_offers
drop policy if exists shop_products_public_select on public.shop_products;
drop policy if exists shop_products_owner_select on public.shop_products;

create policy shop_products_public_select on public.shop_products
  for select
  using (
    status = 'approved'
    or public.is_admin()
    or public.is_shop_owner(brand_shop_id)
    or public.is_shop_owner(primary_shop_id)
  );

-- Offers: use definer helper (does not re-enter product RLS)
drop policy if exists shop_product_offers_public_select on public.shop_product_offers;

create policy shop_product_offers_public_select on public.shop_product_offers
  for select
  using (
    public.is_admin()
    or public.is_shop_owner(shop_id)
    or public.product_is_public(product_id)
  );

notify pgrst, 'reload schema';
