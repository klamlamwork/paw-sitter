create or replace function public.get_user_paw_balance(p_user_id uuid)
returns table (available int, pending int, reserved int)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(delta) filter (where status = 'available'), 0)::int as available,
    greatest(coalesce(sum(delta) filter (where status = 'pending'), 0), 0)::int as pending,
    coalesce(-sum(delta) filter (where status = 'reserved' and delta < 0), 0)::int as reserved
  from public.paw_point_ledger
  where user_id = p_user_id;
$$;

notify pgrst, 'reload schema';
