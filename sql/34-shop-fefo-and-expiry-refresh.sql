-- V5: refresh batch near-expiry / expired status
-- V6: FEFO allocate stock from earliest expiry first
-- Run after sql/33 (batches) and sql/31-32 (variants)

-- Recompute status from expiry + qty
create or replace function public.refresh_batch_expiry_status()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.shop_product_batches b
  set
    status = case
      when b.qty_on_hand <= 0 then 'depleted'
      when b.expiry_date is not null and b.expiry_date < current_date then 'expired'
      when b.expiry_date is not null and b.expiry_date <= current_date + 14 then 'near_expiry'
      when b.status in ('held') then b.status
      else 'active'
    end,
    updated_at = now()
  where b.status is distinct from case
    when b.qty_on_hand <= 0 then 'depleted'
    when b.expiry_date is not null and b.expiry_date < current_date then 'expired'
    when b.expiry_date is not null and b.expiry_date <= current_date + 14 then 'near_expiry'
    when b.status in ('held') then b.status
    else 'active'
  end;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.refresh_batch_expiry_status() from public;
grant execute on function public.refresh_batch_expiry_status() to authenticated;

-- FEFO: deduct qty from soonest-expiring sellable batches
-- Returns remaining unallocated qty (0 = success)
create or replace function public.shop_allocate_fefo(
  p_variant_id uuid,
  p_qty int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int := greatest(coalesce(p_qty, 0), 0);
  rec record;
  take int;
  new_qty int;
begin
  if remaining <= 0 then
    return 0;
  end if;

  if not public.can_manage_variant(p_variant_id) and not public.is_admin() then
    raise exception 'not allowed';
  end if;

  perform public.refresh_batch_expiry_status();

  for rec in
    select id, qty_on_hand
    from public.shop_product_batches
    where variant_id = p_variant_id
      and qty_on_hand > 0
      and status not in ('held', 'depleted', 'expired')
      and (expiry_date is null or expiry_date >= current_date)
    order by expiry_date asc nulls last, created_at asc
    for update
  loop
    exit when remaining <= 0;
    take := least(rec.qty_on_hand, remaining);
    new_qty := rec.qty_on_hand - take;
    update public.shop_product_batches
    set
      qty_on_hand = new_qty,
      status = case when new_qty <= 0 then 'depleted' else status end,
      updated_at = now()
    where id = rec.id;
    remaining := remaining - take;
  end loop;

  update public.shop_product_variants v
  set
    stock_qty = coalesce((
      select sum(b.qty_on_hand)
      from public.shop_product_batches b
      where b.variant_id = v.id
        and b.qty_on_hand > 0
        and b.status not in ('held', 'depleted', 'expired')
        and (b.expiry_date is null or b.expiry_date >= current_date)
    ), 0),
    updated_at = now()
  where v.id = p_variant_id;

  return remaining;
end;
$$;

revoke all on function public.shop_allocate_fefo(uuid, int) from public;
grant execute on function public.shop_allocate_fefo(uuid, int) to authenticated;

notify pgrst, 'reload schema';
