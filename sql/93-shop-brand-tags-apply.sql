-- KOL Phase 2b-3: apply brand/tags from pending_snapshot on admin approve.
-- Does not change shopProductPending.js or live gallery/rating/checkout behavior.
-- Run after sql/92-shop-brand-tags-approval.sql.

create or replace function public.shop_products_protect_public_brand()
returns trigger
language plpgsql
as $$
begin
  -- Content saves that omit brand/tags keep the last requested values.
  if new.pending_snapshot is not null and old.pending_snapshot is not null then
    if not (new.pending_snapshot ? 'brand_name') and (old.pending_snapshot ? 'brand_name') then
      new.pending_snapshot := new.pending_snapshot || jsonb_build_object('brand_name', old.pending_snapshot->'brand_name');
    end if;
    if not (new.pending_snapshot ? 'tag_ids') and (old.pending_snapshot ? 'tag_ids') then
      new.pending_snapshot := new.pending_snapshot || jsonb_build_object('tag_ids', old.pending_snapshot->'tag_ids');
    end if;
  end if;

  -- Admin/service apply: copy brand from the snapshot being cleared.
  if old.status = 'approved'
     and old.has_pending_edit = true
     and new.has_pending_edit = false
     and new.pending_snapshot is null then
    if old.pending_snapshot is not null and (old.pending_snapshot ? 'brand_name') then
      new.brand_name := nullif(btrim(old.pending_snapshot->>'brand_name'), '');
    end if;
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

create or replace function public.shop_products_apply_pending_tags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tag_id uuid;
begin
  if not (old.has_pending_edit = true and new.has_pending_edit = false) then
    return new;
  end if;
  if old.pending_snapshot is null or jsonb_typeof(old.pending_snapshot->'tag_ids') is distinct from 'array' then
    return new;
  end if;

  delete from public.shop_product_tags where product_id = new.id;
  for tag_id in
    select value::uuid
    from jsonb_array_elements_text(old.pending_snapshot->'tag_ids') as t(value)
    where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  loop
    insert into public.shop_product_tags (product_id, tag_id)
    values (new.id, tag_id)
    on conflict do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists shop_products_apply_pending_tags on public.shop_products;
create trigger shop_products_apply_pending_tags
  after update on public.shop_products
  for each row execute function public.shop_products_apply_pending_tags();

notify pgrst, 'reload schema';
