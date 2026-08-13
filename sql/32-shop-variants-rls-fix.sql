-- Fix shop_product_variants RLS (insert was failing for shop owners)
-- Run after sql/31

grant select, insert, update, delete on public.shop_product_variants to authenticated;
grant select on public.shop_product_variants to anon;

-- Can this user manage variants for this product?
create or replace function public.can_manage_product_variants(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.shop_products p
      where p.id = p_product_id
        and (
          public.is_shop_owner(p.primary_shop_id)
          or public.is_shop_owner(p.brand_shop_id)
        )
    );
$$;

revoke all on function public.can_manage_product_variants(uuid) from public;
grant execute on function public.can_manage_product_variants(uuid) to authenticated;
grant execute on function public.can_manage_product_variants(uuid) to anon;

drop policy if exists shop_variants_public_select on public.shop_product_variants;
drop policy if exists shop_variants_owner_write on public.shop_product_variants;
drop policy if exists shop_product_variants_select on public.shop_product_variants;
drop policy if exists shop_product_variants_insert on public.shop_product_variants;
drop policy if exists shop_product_variants_update on public.shop_product_variants;
drop policy if exists shop_product_variants_delete on public.shop_product_variants;

-- SELECT: public sees active on approved products; owners/admin see all theirs
create policy shop_product_variants_select on public.shop_product_variants
  for select
  using (
    public.is_admin()
    or public.can_manage_product_variants(product_id)
    or (
      is_active = true
      and exists (
        select 1 from public.shop_products p
        where p.id = shop_product_variants.product_id
          and p.status = 'approved'
      )
    )
  );

-- INSERT
create policy shop_product_variants_insert on public.shop_product_variants
  for insert
  with check (
    public.can_manage_product_variants(product_id)
  );

-- UPDATE
create policy shop_product_variants_update on public.shop_product_variants
  for update
  using (public.can_manage_product_variants(product_id))
  with check (public.can_manage_product_variants(product_id));

-- DELETE
create policy shop_product_variants_delete on public.shop_product_variants
  for delete
  using (public.can_manage_product_variants(product_id));

notify pgrst, 'reload schema';
