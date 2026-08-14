-- Deduct stock when an order is accepted.
-- Restore if declined/cancelled after accept and before ship.

create table if not exists public.shop_order_stock_moves (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  order_item_id uuid references public.shop_order_items (id) on delete cascade,
  variant_id uuid references public.shop_product_variants (id) on delete set null,
  batch_id uuid references public.shop_product_batches (id) on delete set null,
  qty int not null check (qty > 0),
  created_at timestamptz not null default now()
);

create index if not exists shop_order_stock_moves_order_idx
  on public.shop_order_stock_moves (order_id);

alter table public.shop_order_stock_moves enable row level security;

grant select on public.shop_order_stock_moves to authenticated;

drop policy if exists shop_order_stock_moves_select on public.shop_order_stock_moves;
create policy shop_order_stock_moves_select on public.shop_order_stock_moves
  for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.shop_orders o
      where o.id = shop_order_stock_moves.order_id
        and (
          o.user_id = auth.uid()
          or public.is_shop_owner(o.seller_shop_id)
        )
    )
  );

create or replace function public.set_shop_order_fulfillment(p_order_id uuid, p_new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.shop_orders%rowtype;
  item public.shop_order_items%rowtype;
  v public.shop_product_variants%rowtype;
  rec record;
  remaining int;
  take int;
  has_batches boolean;
  mv record;
begin
  if p_new_status not in ('accepted', 'declined', 'cancelled', 'shipped') then
    raise exception 'Invalid status';
  end if;

  select * into o from public.shop_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if not (public.is_admin() or public.is_shop_owner(o.seller_shop_id)) then
    raise exception 'Not allowed to update this order';
  end if;

  if o.status = p_new_status then
    return;
  end if;

  if p_new_status = 'accepted' then
    if o.status is distinct from 'pending' then
      raise exception 'Only a pending order can be accepted';
    end if;

    if exists (select 1 from public.shop_order_stock_moves where order_id = o.id) then
      update public.shop_orders
        set status = 'accepted', updated_at = now()
        where id = o.id;
      return;
    end if;

    for item in
      select * from public.shop_order_items where order_id = o.id
    loop
      if item.variant_id is null then
        continue;
      end if;

      select * into v from public.shop_product_variants where id = item.variant_id for update;
      if not found then
        continue;
      end if;

      remaining := item.qty;
      select exists (
        select 1 from public.shop_product_batches b
        where b.variant_id = item.variant_id
      ) into has_batches;

      if has_batches then
        for rec in
          select b.id, b.qty_on_hand
          from public.shop_product_batches b
          where b.variant_id = item.variant_id
            and b.status not in ('held', 'depleted', 'expired')
            and b.qty_on_hand > 0
            and (b.expiry_date is null or b.expiry_date >= current_date)
          order by b.expiry_date asc nulls last, b.created_at asc
          for update
        loop
          exit when remaining <= 0;
          take := least(remaining, rec.qty_on_hand);
          update public.shop_product_batches
            set qty_on_hand = qty_on_hand - take,
                status = case when qty_on_hand - take <= 0 then 'depleted' else status end,
                updated_at = now()
            where id = rec.id;
          insert into public.shop_order_stock_moves (order_id, order_item_id, variant_id, batch_id, qty)
          values (o.id, item.id, item.variant_id, rec.id, take);
          remaining := remaining - take;
        end loop;
      elsif coalesce(v.track_stock, true) then
        if coalesce(v.stock_qty, 0) < remaining then
          raise exception 'Not enough stock for %', v.name;
        end if;
        update public.shop_product_variants
          set stock_qty = stock_qty - remaining,
              updated_at = now()
          where id = v.id;
        insert into public.shop_order_stock_moves (order_id, order_item_id, variant_id, batch_id, qty)
        values (o.id, item.id, item.variant_id, null, remaining);
        remaining := 0;
      else
        remaining := 0;
      end if;

      if remaining > 0 then
        raise exception 'Not enough stock for %', coalesce(v.name, 'item');
      end if;
    end loop;

    update public.shop_orders
      set status = 'accepted', updated_at = now()
      where id = o.id;
    return;
  end if;

  if p_new_status in ('declined', 'cancelled') then
    if o.status = 'shipped' then
      raise exception 'Cannot cancel a shipped order';
    end if;

    if o.status = 'accepted' then
      for mv in
        select * from public.shop_order_stock_moves where order_id = o.id
      loop
        if mv.batch_id is not null then
          update public.shop_product_batches
            set qty_on_hand = qty_on_hand + mv.qty,
                status = case
                  when status = 'depleted' and qty_on_hand + mv.qty > 0 then 'active'
                  else status
                end,
                updated_at = now()
            where id = mv.batch_id;
        elsif mv.variant_id is not null then
          update public.shop_product_variants
            set stock_qty = stock_qty + mv.qty,
                updated_at = now()
            where id = mv.variant_id;
        end if;
      end loop;
      delete from public.shop_order_stock_moves where order_id = o.id;
    end if;

    update public.shop_orders
      set status = p_new_status, updated_at = now()
      where id = o.id;
    return;
  end if;

  if p_new_status = 'shipped' then
    if o.status is distinct from 'accepted' then
      raise exception 'Only an accepted order can be marked shipped';
    end if;
    update public.shop_orders
      set status = 'shipped', updated_at = now()
      where id = o.id;
  end if;
end;
$$;

revoke all on function public.set_shop_order_fulfillment(uuid, text) from public;
grant execute on function public.set_shop_order_fulfillment(uuid, text) to authenticated;

notify pgrst, 'reload schema';
