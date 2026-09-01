-- KOL Phase 2b-1: brand/tags stay behind the same product re-approval gate.
-- Additive. Does not change galleries, ratings, checkout, or Paw Points.
-- Run after sql/91-shop-tags-policies.sql.

-- Owners must not create public tags. Taxonomy stays admin-controlled.
drop policy if exists shop_tags_owner_insert on public.shop_tags;

-- Owners must not rewrite live tags on approved products.
drop policy if exists shop_product_tags_owner on public.shop_product_tags;

create policy shop_product_tags_owner_pending on public.shop_product_tags
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = product_id
        and (public.is_shop_owner(p.primary_shop_id) or public.is_shop_owner(p.brand_shop_id))
        and p.status <> 'approved'
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = product_id
        and (public.is_shop_owner(p.primary_shop_id) or public.is_shop_owner(p.brand_shop_id))
        and p.status <> 'approved'
    )
  );

-- If an owner tries to change live brand_name on an approved product, keep the
-- public value and stash the requested brand on pending_snapshot instead.
-- Admin/service apply is allowed when a pending edit is being cleared.
create or replace function public.shop_products_protect_public_brand()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved'
     and old.has_pending_edit = true
     and new.has_pending_edit = false
     and new.pending_snapshot is null then
    return new;
  end if;

  if old.status = 'approved' and new.brand_name is distinct from old.brand_name then
    new.pending_snapshot := coalesce(new.pending_snapshot, '{}'::jsonb)
      || jsonb_build_object('brand_name', new.brand_name);
    new.has_pending_edit := true;
    new.pending_submitted_at := coalesce(new.pending_submitted_at, now());
    new.brand_name := old.brand_name;
  end if;

  return new;
end;
$$;

drop trigger if exists shop_products_protect_public_brand on public.shop_products;
create trigger shop_products_protect_public_brand
  before update on public.shop_products
  for each row execute function public.shop_products_protect_public_brand();

notify pgrst, 'reload schema';
