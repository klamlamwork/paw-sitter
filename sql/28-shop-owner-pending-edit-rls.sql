-- Allow shop owners to submit pending edits on approved products
-- without changing live status (status stays approved, has_pending_edit = true)
-- Run after sql/23 and sql/27

drop policy if exists shop_products_owner_update on public.shop_products;
create policy shop_products_owner_update on public.shop_products
  for update
  using (
    public.is_admin()
    or public.is_shop_owner(brand_shop_id)
    or public.is_shop_owner(primary_shop_id)
  )
  with check (
    public.is_admin()
    or (
      (
        public.is_shop_owner(brand_shop_id)
        or public.is_shop_owner(primary_shop_id)
      )
      and (
        -- New / not live: owner cannot self-approve
        status in ('draft', 'pending', 'archived', 'rejected')
        -- Live product: may only queue a pending snapshot (status remains approved)
        or (status = 'approved' and has_pending_edit = true)
        -- Live product: discard pending (has_pending_edit false) — admin usually does this;
        -- owners may clear their own pending resubmit by rewriting snapshot
        or (status = 'approved' and has_pending_edit = false and pending_snapshot is null)
      )
    )
  );

notify pgrst, 'reload schema';
