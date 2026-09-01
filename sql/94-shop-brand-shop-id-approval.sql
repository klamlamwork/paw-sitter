-- Apply brand_shop_id from pending_snapshot on admin approve.
-- Run after sql/93-shop-brand-tags-apply.sql.

create or replace function public.shop_products_protect_public_brand()
returns trigger
language plpgsql
as $$
begin
  if new.pending_snapshot is not null and old.pending_snapshot is not null then
    if not (new.pending_snapshot ? 'brand_name') and (old.pending_snapshot ? 'brand_name') then
      new.pending_snapshot := new.pending_snapshot || jsonb_build_object('brand_name', old.pending_snapshot->'brand_name');
    end if;
    if not (new.pending_snapshot ? 'tag_ids') and (old.pending_snapshot ? 'tag_ids') then
      new.pending_snapshot := new.pending_snapshot || jsonb_build_object('tag_ids', old.pending_snapshot->'tag_ids');
    end if;
    if not (new.pending_snapshot ? 'brand_shop_id') and (old.pending_snapshot ? 'brand_shop_id') then
      new.pending_snapshot := new.pending_snapshot || jsonb_build_object('brand_shop_id', old.pending_snapshot->'brand_shop_id');
    end if;
  end if;

  if old.status = 'approved'
     and old.has_pending_edit = true
     and new.has_pending_edit = false
     and new.pending_snapshot is null then
    if old.pending_snapshot is not null and (old.pending_snapshot ? 'brand_name') then
      new.brand_name := nullif(btrim(old.pending_snapshot->>'brand_name'), '');
    end if;
    if old.pending_snapshot is not null and (old.pending_snapshot ? 'brand_shop_id') then
      new.brand_shop_id := nullif(old.pending_snapshot->>'brand_shop_id', '')::uuid;
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

  if old.status = 'approved' and new.brand_shop_id is distinct from old.brand_shop_id then
    new.pending_snapshot := coalesce(new.pending_snapshot, '{}'::jsonb)
      || jsonb_build_object('brand_shop_id', new.brand_shop_id);
    new.has_pending_edit := true;
    new.pending_submitted_at := coalesce(new.pending_submitted_at, now());
    new.brand_shop_id := old.brand_shop_id;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
