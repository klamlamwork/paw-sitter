-- Run once to deduct stock for all paid orders and update both batches and variants.
-- Safe to re-run: uses shop_order_stock_moves to avoid double deduction.

with paid_orders as (
  select id
  from shop_orders
  where payment_status = 'paid'
),
items_to_deduct as (
  select
    o.id as order_id,
    i.id as order_item_id,
    i.variant_id,
    i.product_id,
    i.qty
  from paid_orders o
  join shop_order_items i on i.order_id = o.id
  where not exists (
    select 1 from shop_order_stock_moves m where m.order_id = o.id and m.order_item_id = i.id
  )
),
fefo_batches as (
  select
    itd.order_id,
    itd.order_item_id,
    itd.variant_id,
    itd.product_id,
    itd.qty as needed,
    b.id as batch_id,
    b.qty_on_hand,
    b.expiry_date,
    b.status,
    row_number() over (
      partition by itd.order_id, itd.order_item_id
      order by b.expiry_date asc nulls last, b.created_at asc
    ) as rn
  from items_to_deduct itd
  join shop_product_batches b
    on (itd.variant_id is not null and b.variant_id = itd.variant_id)
   and b.qty_on_hand > 0
   and b.status not in ('held','depleted','expired')
   and (b.expiry_date is null or b.expiry_date >= current_date)
),
batch_deductions as (
  select
    order_id,
    order_item_id,
    variant_id,
    batch_id,
    least(needed, qty_on_hand) as take
  from fefo_batches
  where rn = 1
),
remaining_after_batch as (
  select
    bd.order_id,
    bd.order_item_id,
    bd.variant_id,
    bd.batch_id,
    bd.take,
    (select qty from shop_order_items where id = bd.order_item_id) - bd.take as remaining
  from batch_deductions bd
),
variant_fallback as (
  select
    rab.order_id,
    rab.order_item_id,
    rab.variant_id,
    rab.batch_id,
    rab.take,
    rab.remaining,
    v.stock_qty as variant_stock,
    least(rab.remaining, v.stock_qty) as take_from_variant
  from remaining_after_batch rab
  join shop_product_variants v on v.id = rab.variant_id
  where rab.remaining > 0 and v.track_stock is not false
),
final_moves as (
  select order_id, order_item_id, variant_id, batch_id, take as qty from batch_deductions
  union all
  select order_id, order_item_id, variant_id, null as batch_id, take_from_variant as qty
  from variant_fallback
  where take_from_variant > 0
),
inserted_moves as (
  insert into shop_order_stock_moves (order_id, order_item_id, variant_id, batch_id, qty)
  select order_id, order_item_id, variant_id, batch_id, qty from final_moves
  on conflict do nothing
  returning *
),
update_batches as (
  update shop_product_batches b
  set qty_on_hand = b.qty_on_hand - d.take,
      status = case when b.qty_on_hand - d.take <= 0 then 'depleted' else b.status end,
      updated_at = now()
  from (select batch_id, take from final_moves where batch_id is not null) d
  where b.id = d.batch_id
),
update_variants as (
  update shop_product_variants v
  set stock_qty = v.stock_qty - d.take_from_variant,
      updated_at = now()
  from (select variant_id, take_from_variant from variant_fallback where take_from_variant > 0) d
  where v.id = d.variant_id
)
select 'done' as status;
