-- Fix admin product approval: inserting gallery rows was blocked by RLS
-- after the product row was already set to approved.
-- Run in Supabase SQL editor.

grant select, insert, update, delete on public.shop_product_media to authenticated;
grant select, insert, update, delete on public.shop_product_longevity_items to authenticated;

drop policy if exists shop_product_media_admin_all on public.shop_product_media;
create policy shop_product_media_admin_all on public.shop_product_media
  for all
  using (public.is_admin())
  with check (public.is_admin());

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

drop policy if exists shop_product_longevity_admin_all on public.shop_product_longevity_items;
create policy shop_product_longevity_admin_all on public.shop_product_longevity_items
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists shop_product_longevity_items_owner on public.shop_product_longevity_items;
create policy shop_product_longevity_items_owner on public.shop_product_longevity_items
  for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_longevity_items.product_id
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
      where p.id = shop_product_longevity_items.product_id
        and (
          public.is_shop_owner(p.brand_shop_id)
          or public.is_shop_owner(p.primary_shop_id)
        )
    )
  );

notify pgrst, 'reload schema';
