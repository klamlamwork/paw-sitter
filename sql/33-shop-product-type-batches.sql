-- V1: product_type + inventory_mode
-- V3: batches with expiry for batch_expiry mode

-- Product type drives default inventory rules
alter table public.shop_products
  add column if not exists product_type text not null default 'other';

alter table public.shop_products
  add column if not exists inventory_mode text not null default 'simple';

-- Normalize any bad values
update public.shop_products
set product_type = 'other'
where product_type is null or product_type = '';

update public.shop_products
set inventory_mode = case
  when product_type in ('food', 'treats', 'supplements', 'litter') then 'batch_expiry'
  else 'simple'
end
where inventory_mode is null
   or inventory_mode not in ('simple', 'batch_expiry');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shop_products_product_type_check'
  ) then
    alter table public.shop_products
      add constraint shop_products_product_type_check
      check (product_type in (
        'food', 'treats', 'supplements', 'litter',
        'bowls', 'beds', 'toys', 'grooming', 'apparel', 'other'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'shop_products_inventory_mode_check'
  ) then
    alter table public.shop_products
      add constraint shop_products_inventory_mode_check
      check (inventory_mode in ('simple', 'batch_expiry'));
  end if;
end $$;

comment on column public.shop_products.product_type is
  'Merch type: food/treats/supplements/litter use batch_expiry by default';
comment on column public.shop_products.inventory_mode is
  'simple = qty on variant; batch_expiry = lots with expiry dates';

-- Batches (qty + expiry under a variant)
create table if not exists public.shop_product_batches (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.shop_product_variants (id) on delete cascade,
  shop_id uuid not null references public.shop_shops (id) on delete cascade,
  lot_code text default '',
  qty_on_hand int not null default 0 check (qty_on_hand >= 0),
  expiry_date date,
  received_at date default current_date,
  status text not null default 'active'
    check (status in ('active', 'near_expiry', 'expired', 'held', 'depleted')),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_product_batches_variant_idx
  on public.shop_product_batches (variant_id);
create index if not exists shop_product_batches_expiry_idx
  on public.shop_product_batches (expiry_date)
  where expiry_date is not null;
create index if not exists shop_product_batches_shop_idx
  on public.shop_product_batches (shop_id);

alter table public.shop_product_batches enable row level security;

grant select, insert, update, delete on public.shop_product_batches to authenticated;
grant select on public.shop_product_batches to anon;

-- Reuse product ownership helper if present; else inline
create or replace function public.can_manage_variant(p_variant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.shop_product_variants v
      join public.shop_products p on p.id = v.product_id
      where v.id = p_variant_id
        and (
          public.is_shop_owner(v.shop_id)
          or public.is_shop_owner(p.primary_shop_id)
          or public.is_shop_owner(p.brand_shop_id)
        )
    );
$$;

revoke all on function public.can_manage_variant(uuid) from public;
grant execute on function public.can_manage_variant(uuid) to authenticated;
grant execute on function public.can_manage_variant(uuid) to anon;

drop policy if exists shop_batches_select on public.shop_product_batches;
drop policy if exists shop_batches_insert on public.shop_product_batches;
drop policy if exists shop_batches_update on public.shop_product_batches;
drop policy if exists shop_batches_delete on public.shop_product_batches;

create policy shop_batches_select on public.shop_product_batches
  for select using (
    public.is_admin()
    or public.can_manage_variant(variant_id)
    or public.is_shop_owner(shop_id)
  );

create policy shop_batches_insert on public.shop_product_batches
  for insert with check (
    public.can_manage_variant(variant_id)
  );

create policy shop_batches_update on public.shop_product_batches
  for update
  using (public.can_manage_variant(variant_id))
  with check (public.can_manage_variant(variant_id));

create policy shop_batches_delete on public.shop_product_batches
  for delete using (public.can_manage_variant(variant_id));

-- Allow shop owners to update product_type / inventory_mode on their products
-- (covered by existing product update policies if status rules allow;
--  inventory fields can also be set on create)

notify pgrst, 'reload schema';
