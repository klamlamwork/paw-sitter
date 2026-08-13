-- V6: FEFO allocation — reserve earliest-expiry batches first
-- Run after sql/33 (shop_product_batches)

alter table public.shop_product_batches
  add column if not exists qty_reserved int not null default 0;

-- qty_reserved cannot exceed on-hand (soft check; function enforces)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shop_product_batches_reserved_check'
  ) then
    alter table public.shop_product_batches
      add constraint shop_product_batches_reserved_check
      check (qty_reserved >= 0);
  end if;
end $$;

create table if not exists public.shop_fefo_allocations (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.shop_product_variants (id) on delete cascade,
  batch_id uuid not null references public.shop_product_batches (id) on delete cascade,
  qty int not null check (qty > 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'released')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_fefo_allocations_variant_idx
  on public.shop_fefo_allocations (variant_id, status);
create index if not exists shop_fefo_allocations_batch_idx
  on public.shop_fefo_allocations (batch_id, status);

alter table public.shop_fefo_allocations enable row level security;

grant select, insert, update, delete on public.shop_fefo_allocations to authenticated;

-- Sellable rows: not expired, not held/depleted, has remaining qty
create or replace function public.fefo_available_qty(p_qty_on_hand int, p_qty_reserved int)
returns int
language sql
immutable
as $$
  select greatest(coalesce(p_qty_on_hand, 0) - coalesce(p_qty_reserved, 0), 0);
$$;

-- Preview / allocate FEFO. p_commit = false → preview only (no writes)
-- Returns table of batch_id, expiry_date, qty_take
create or replace function public.allocate_fefo(
  p_variant_id uuid,
  p_qty int,
  p_commit boolean default false,
  p_created_by uuid default null
)
returns table (
  batch_id uuid,
  expiry_date date,
  lot_code text,
  qty_take int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int := greatest(coalesce(p_qty, 0), 0);
  rec record;
  take int;
begin
  if remaining <= 0 then
    return;
  end if;

  for rec in
    select
      b.id,
      b.expiry_date,
      b.lot_code,
      public.fefo_available_qty(b.qty_on_hand, b.qty_reserved) as avail
    from public.shop_product_batches b
    where b.variant_id = p_variant_id
      and b.status not in ('held', 'depleted', 'expired')
      and public.fefo_available_qty(b.qty_on_hand, b.qty_reserved) > 0
      and (b.expiry_date is null or b.expiry_date >= current_date)
    order by b.expiry_date asc nulls last, b.created_at asc
  loop
    exit when remaining <= 0;
    take := least(remaining, rec.avail);
    if take <= 0 then
      continue;
    end if;

    if p_commit then
      update public.shop_product_batches
      set qty_reserved = qty_reserved + take,
          updated_at = now()
      where id = rec.id;

      insert into public.shop_fefo_allocations (
        variant_id, batch_id, qty, status, created_by
      ) values (
        p_variant_id, rec.id, take, 'reserved', p_created_by
      );
    end if;

    batch_id := rec.id;
    expiry_date := rec.expiry_date;
    lot_code := rec.lot_code;
    qty_take := take;
    remaining := remaining - take;
    return next;
  end loop;
end;
$$;

revoke all on function public.allocate_fefo(uuid, int, boolean, uuid) from public;
grant execute on function public.allocate_fefo(uuid, int, boolean, uuid) to authenticated;
grant execute on function public.allocate_fefo(uuid, int, boolean, uuid) to anon;

-- RLS: owners/admin can see allocations for their variants
drop policy if exists shop_fefo_select on public.shop_fefo_allocations;
drop policy if exists shop_fefo_write on public.shop_fefo_allocations;

create policy shop_fefo_select on public.shop_fefo_allocations
  for select using (
    public.is_admin()
    or public.can_manage_variant(variant_id)
    or created_by = auth.uid()
  );

create policy shop_fefo_write on public.shop_fefo_allocations
  for all
  using (
    public.is_admin()
    or public.can_manage_variant(variant_id)
    or created_by = auth.uid()
  )
  with check (
    public.is_admin()
    or public.can_manage_variant(variant_id)
    or created_by = auth.uid()
  );

notify pgrst, 'reload schema';
