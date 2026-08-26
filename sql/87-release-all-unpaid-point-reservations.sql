-- One-time repair for the old pre-payment reservation design.
-- Removes all Paw Point redemption reservations attached to unpaid shop orders
-- and unpaid/unfinished bookings. Run once in Supabase SQL editor.

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
  'Released old pre-payment Paw Points reservation'
from public.paw_point_ledger l
left join public.shop_orders o on o.id = l.order_id
left join public.bookings b on b.id = l.booking_id
where l.reason = 'redeem'
  and l.status = 'reserved'
  and l.delta < 0
  and (
    (l.order_id is not null and coalesce(o.payment_status, 'unpaid') <> 'paid')
    or (l.booking_id is not null and coalesce(b.payment_status, 'unpaid') <> 'paid')
  );

delete from public.paw_point_ledger l
using public.shop_orders o
where o.id = l.order_id
  and l.reason = 'redeem'
  and l.status = 'reserved'
  and l.delta < 0
  and coalesce(o.payment_status, 'unpaid') <> 'paid';

delete from public.paw_point_ledger l
using public.bookings b
where b.id = l.booking_id
  and l.reason = 'redeem'
  and l.status = 'reserved'
  and l.delta < 0
  and coalesce(b.payment_status, 'unpaid') <> 'paid';

notify pgrst, 'reload schema';
