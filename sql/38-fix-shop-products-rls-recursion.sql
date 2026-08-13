-- FIX: infinite recursion on shop_products
-- Cause: shop_products policies SELECT shop_product_offers,
--        and shop_product_offers policies SELECT shop_products.
-- Data is not deleted — reads were blocked.
-- Run this in Supabase SQL editor as postgres.

-- Helpers bypass RLS (security definer)
create or replace function public.product_is_approved(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_products p
    where p.id = p_product_id and p.status = 'approved'
  );
$$;

create or replace function public.can_manage_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = p_product_id
        and (
          public.is_shop_owner(p.primary_shop_id)
          or public.is_shop_owner(p.brand_shop_id)
        )
    );
$$;

create or replace function public.owns_offer_on_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_product_offers o
    where o.product_id = p_product_id
      and public.is_shop_owner(o.shop_id)
  );
$$;

revoke all on function public.product_is_approved(uuid) from public;
revoke all on function public.can_manage_product(uuid) from public;
revoke all on function public.owns_offer_on_product(uuid) from public;
grant execute on function public.product_is_approved(uuid) to authenticated, anon;
grant execute on function public.can_manage_product(uuid) to authenticated, anon;
grant execute on function public.owns_offer_on_product(uuid) to authenticated, anon;

-- Recreate product SELECT without joining offers in-policy
drop policy if exists shop_products_public_select on public.shop_products;
drop policy if exists shop_products_owner_select on public.shop_products;

create policy shop_products_public_select on public.shop_products
  for select using (
    status = 'approved'
    or public.is_admin()
    or public.is_shop_owner(brand_shop_id)
    or public.is_shop_owner(primary_shop_id)
    or public.owns_offer_on_product(id)
  );

-- Keep insert/update policies; they must not query offers either
-- (existing owner insert/update already use is_shop_owner on columns)

-- Offers: do NOT select shop_products here — use helper
drop policy if exists shop_product_offers_public_select on public.shop_product_offers;
create policy shop_product_offers_public_select on public.shop_product_offers
  for select using (
    public.is_admin()
    or public.is_shop_owner(shop_id)
    or public.product_is_approved(product_id)
  );

notify pgrst, 'reload schema';
