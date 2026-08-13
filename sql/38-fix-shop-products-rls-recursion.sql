-- BREAK RLS cycle: shop_products <-> shop_product_offers
-- Public catalog was returning 0 rows (infinite recursion)

create or replace function public.product_is_approved(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_products p
    where p.id = p_id and p.status = 'approved'
  );
$$;

revoke all on function public.product_is_approved(uuid) from public;
grant execute on function public.product_is_approved(uuid) to authenticated;
grant execute on function public.product_is_approved(uuid) to anon;

-- Drop every SELECT policy that can recurse
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
    or public.product_is_approved(product_id)
  );

notify pgrst, 'reload schema';
