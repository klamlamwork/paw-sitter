-- Any active shop owner can create products (retailer or product brand).
-- Run after sql/22.

-- Insert: owner of brand_shop OR primary_shop; pending/draft only
drop policy if exists shop_products_owner_insert on public.shop_products;
create policy shop_products_owner_insert on public.shop_products
  for insert
  with check (
    public.is_admin()
    or (
      created_by = auth.uid()
      and status in ('draft', 'pending')
      and (
        public.is_shop_owner(brand_shop_id)
        or public.is_shop_owner(primary_shop_id)
      )
    )
  );

-- Update: brand shop owner OR primary shop owner; cannot self-approve
drop policy if exists shop_products_owner_update on public.shop_products;
create policy shop_products_owner_update on public.shop_products
  for update
  using (
    public.is_admin()
    or public.is_shop_owner(brand_shop_id)
    or public.is_shop_owner(primary_shop_id)
  )
  with check (
    public.is_admin()
    or (
      (
        public.is_shop_owner(brand_shop_id)
        or public.is_shop_owner(primary_shop_id)
      )
      and status in ('draft', 'pending', 'archived')
    )
  );

-- Select: also primary shop owners
drop policy if exists shop_products_owner_select on public.shop_products;
create policy shop_products_owner_select on public.shop_products
  for select
  using (
    status = 'approved'
    or public.is_admin()
    or public.is_shop_owner(brand_shop_id)
    or public.is_shop_owner(primary_shop_id)
    or exists (
      select 1 from public.shop_product_offers o
      where o.product_id = shop_products.id
        and public.is_shop_owner(o.shop_id)
    )
  );

-- Media write: brand shop or primary shop owner
drop policy if exists shop_product_media_owner_write on public.shop_product_media;
create policy shop_product_media_owner_write on public.shop_product_media
  for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_media.product_id
        and (
          public.is_shop_owner(p.brand_shop_id)
          or public.is_shop_owner(p.primary_shop_id)
        )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_media.product_id
        and (
          public.is_shop_owner(p.brand_shop_id)
          or public.is_shop_owner(p.primary_shop_id)
        )
    )
  );

notify pgrst, 'reload schema';
