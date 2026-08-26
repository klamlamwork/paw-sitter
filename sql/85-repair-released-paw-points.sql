-- Repairs Paw Points that remained deducted after a Stripe checkout was canceled.
-- The prior release code changed a negative FIFO reservation to status=released,
-- but the balance calculation still counted the negative lot movement as spent.
-- Run once in the Supabase SQL editor.

-- Remove the compensating positive rows created by the previous release code.
-- Their source reservation is no longer a valid spend, so keeping both would over-credit.
delete from public.paw_point_ledger p
where p.reason = 'unreserve'
  and p.status = 'available'
  and exists (
    select 1
    from public.paw_point_ledger r
    where r.user_id = p.user_id
      and r.reason = 'redeem'
      and r.status = 'released'
      and r.delta < 0
      and (
        (r.order_id is not null and r.order_id = p.order_id)
        or (r.booking_id is not null and r.booking_id = p.booking_id)
      )
  );

-- Remove the old negative reservation itself so the source Paw Point lot is
-- available again. This is equivalent to undoing an uncompleted checkout.
delete from public.paw_point_ledger
where reason = 'redeem'
  and status = 'released'
  and delta < 0;

notify pgrst, 'reload schema';
