-- One-time repair: release Paw Point redemption reservations tied to unpaid shop orders.
-- These are incomplete card checkouts, so the points must become available again.
-- Run in Supabase SQL editor after deploying the matching code fix.

-- Preserve an audit note for each released reservation. delta=0 is intentional.
insert into public.paw_point_ledger (
  user_id, delta, status, reason, order_id, booking_id, remark
)
select
  l.user_id,
  0,
  'available',
  'admin_adjust',
  l.order_id,
  l.booking_id,
  'Released reserved Paw Points from unpaid Stripe checkout'
from public.paw_point_ledger l
join public.shop_orders o on o.id = l.order_id
where l.reason = 'redeem'
  and l.status = 'reserved'
  and l.delta < 0
  and coalesce(o.payment_status, 'unpaid') <> 'paid';

-- Remove the negative FIFO reservations so their source available lots are usable again.
delete from public.paw_point_ledger l
using public.shop_orders o
where o.id = l.order_id
  and l.reason = 'redeem'
  and l.status = 'reserved'
  and l.delta < 0
  and coalesce(o.payment_status, 'unpaid') <> 'paid';

notify pgrst, 'reload schema';
