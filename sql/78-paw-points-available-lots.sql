create or replace function public.get_user_paw_balance(p_user_id uuid)
returns table (available int, pending int, reserved int)
language sql
stable
security definer
set search_path = public
as $$
  with ledger as (
    select id, delta, status, reason, lot_id
    from public.paw_point_ledger
    where user_id = p_user_id
  ),
  spent as (
    select lot_id, coalesce(sum(abs(delta)), 0) as used
    from ledger
    where delta < 0 and lot_id is not null and reason <> 'activate'
    group by lot_id
  )
  select
    greatest(coalesce((
      select sum(greatest(l.delta - coalesce(s.used, 0), 0))
      from ledger l
      left join spent s on s.lot_id = l.id
      where l.status = 'available' and l.delta > 0
    ), 0), 0)::int as available,
    greatest(coalesce((select sum(delta) from ledger where status = 'pending'), 0), 0)::int as pending,
    greatest(coalesce((select -sum(delta) from ledger where status = 'reserved' and delta < 0), 0), 0)::int as reserved;
$$;

notify pgrst, 'reload schema';
