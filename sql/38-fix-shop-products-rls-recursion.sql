-- sql/38: BREAK shop_products / shop_product_offers RLS recursion
-- Public catalog was returning 0 rows because policies queried each other.

create or replace function public.product_is_public(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_products p
    where p.id = p_product_id
      and p.status = 'approved'
  );
$$;

revoke all on function public.product_is_public(uuid) from public;
grant execute on function public.product_is_public(uuid) to authenticated;
grant execute on function public.product_is_public(uuid) to anon;

-- Drop every SELECT policy that can participate in the loop
drop policy if exists shop_products_public_select on public.shop_products;
drop policy if exists shop_products_owner_select on public.shop_products;
drop policy if exists shop_product_offers_public_select on public.shop_product_offers;
drop policy if exists shop_product_offers_owner_select on public.shop_product_offers;

-- Products: NO subquery to shop_product_offers
create policy shop_products_public_select on public.shop_products
  for select
  using (
    status = 'approved'
    or public.is_admin()
    or public.is_shop_owner(brand_shop_id)
    or public.is_shop_owner(primary_shop_id)
  );

-- Offers: do NOT select shop_products under RLS — use definer helper
create policy shop_product_offers_public_select on public.shop_product_offers
  for select
  using (
    public.is_admin()
    or public.is_shop_owner(shop_id)
    or public.product_is_public(product_id)
  );

notify pgrst, 'reload schema';
