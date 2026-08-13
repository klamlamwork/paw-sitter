-- Shop owner RLS — owners manage products/offers for shops they own
-- Run after sql/20 + sql/21
-- Admin policies already exist via is_admin()

-- Helper: true if current user owns this shop (active)
create or replace function public.is_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_shops s
    where s.id = p_shop_id
      and s.owner_profile_id = auth.uid()
      and s.status = 'active'
  );
$$;

revoke all on function public.is_shop_owner(uuid) from public;
grant execute on function public.is_shop_owner(uuid) to authenticated;
grant execute on function public.is_shop_owner(uuid) to anon;

-- Owner can read their shops (including non-public statuses they own)
drop policy if exists shop_shops_owner_select on public.shop_shops;
create policy shop_shops_owner_select on public.shop_shops
  for select
  using (
    public.is_admin()
    or status = 'active'
    or owner_profile_id = auth.uid()
  );

-- Owner can update limited fields on their shop (not status reassignment by default — admin controls status)
drop policy if exists shop_shops_owner_update on public.shop_shops;
create policy shop_shops_owner_update on public.shop_shops
  for update
  using (public.is_admin() or owner_profile_id = auth.uid())
  with check (public.is_admin() or owner_profile_id = auth.uid());

-- Products: owners of brand_shop can insert/update/select their products
-- (retailers attach via offers; product brand owns canonical product)

drop policy if exists shop_products_owner_select on public.shop_products;
create policy shop_products_owner_select on public.shop_products
  for select
  using (
    status = 'approved'
    or public.is_admin()
    or public.is_shop_owner(brand_shop_id)
    or exists (
      select 1 from public.shop_product_offers o
      where o.product_id = shop_products.id
        and public.is_shop_owner(o.shop_id)
    )
  );

drop policy if exists shop_products_owner_insert on public.shop_products;
create policy shop_products_owner_insert on public.shop_products
  for insert
  with check (
    public.is_admin()
    or (
      public.is_shop_owner(brand_shop_id)
      and created_by = auth.uid()
      and status in ('draft', 'pending')
    )
  );

drop policy if exists shop_products_owner_update on public.shop_products;
create policy shop_products_owner_update on public.shop_products
  for update
  using (
    public.is_admin()
    or public.is_shop_owner(brand_shop_id)
  )
  with check (
    public.is_admin()
    or (
      public.is_shop_owner(brand_shop_id)
      -- owners cannot self-approve
      and status in ('draft', 'pending', 'archived')
    )
  );

-- Media: owner of product's brand shop
drop policy if exists shop_product_media_owner_select on public.shop_product_media;
create policy shop_product_media_owner_select on public.shop_product_media
  for select
  using (
    true
    or public.is_admin()
  );

drop policy if exists shop_product_media_owner_write on public.shop_product_media;
create policy shop_product_media_owner_write on public.shop_product_media
  for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_media.product_id
        and public.is_shop_owner(p.brand_shop_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_media.product_id
        and public.is_shop_owner(p.brand_shop_id)
    )
  );

-- Offers: shop owner manages offers for their shop_id
drop policy if exists shop_product_offers_owner_select on public.shop_product_offers;
create policy shop_product_offers_owner_select on public.shop_product_offers
  for select
  using (
    status = 'approved'
    or public.is_admin()
    or public.is_shop_owner(shop_id)
  );

drop policy if exists shop_product_offers_owner_insert on public.shop_product_offers;
create policy shop_product_offers_owner_insert on public.shop_product_offers
  for insert
  with check (
    public.is_admin()
    or (
      public.is_shop_owner(shop_id)
      and status in ('draft', 'pending')
    )
  );

drop policy if exists shop_product_offers_owner_update on public.shop_product_offers;
create policy shop_product_offers_owner_update on public.shop_product_offers
  for update
  using (public.is_admin() or public.is_shop_owner(shop_id))
  with check (
    public.is_admin()
    or (
      public.is_shop_owner(shop_id)
      and status in ('draft', 'pending', 'archived')
    )
  );

drop policy if exists shop_product_offers_owner_delete on public.shop_product_offers;
create policy shop_product_offers_owner_delete on public.shop_product_offers
  for delete
  using (public.is_admin() or public.is_shop_owner(shop_id));

-- Categories: owners need read (already public select)
-- Related products: leave admin-only write for now

notify pgrst, 'reload schema';
