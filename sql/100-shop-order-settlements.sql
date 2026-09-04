-- Per-seller and per-item checkout settlement snapshots.
-- Schema only: does not alter checkout, cart, Stripe, order UI, refunds, Paw Points, or escrow jobs.
-- Run after sql/99-shop-item-points-source-key.sql.

create table if not exists public.shop_order_settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.shop_orders (id) on delete cascade,
  merchandise_cents int not null default 0 check (merchandise_cents >= 0),
  discount_cents int not null default 0 check (discount_cents >= 0),
  discount_sponsor text not null default 'none' check (discount_sponsor in ('none', 'vendor', 'platform')),
  shipping_cents int not null default 0 check (shipping_cents >= 0),
  points_redeemed int not null default 0 check (points_redeemed >= 0),
  points_redeemed_cents int not null default 0 check (points_redeemed_cents >= 0),
  points_earned int not null default 0 check (points_earned >= 0),
  seller_escrow_cents int not null default 0 check (seller_escrow_cents >= 0),
  platform_escrow_cents int not null default 0 check (platform_escrow_cents >= 0),
  display_total_cents int not null default 0 check (display_total_cents >= 0),
  shipping_refunded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_order_settlements_order_idx
  on public.shop_order_settlements (order_id);

create table if not exists public.shop_order_item_settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  order_item_id uuid not null unique references public.shop_order_items (id) on delete cascade,
  qty int not null default 0 check (qty >= 0),
  merchandise_cents int not null default 0 check (merchandise_cents >= 0),
  discount_cents int not null default 0 check (discount_cents >= 0),
  discount_sponsor text not null default 'none' check (discount_sponsor in ('none', 'vendor', 'platform')),
  points_redeemed int not null default 0 check (points_redeemed >= 0),
  points_redeemed_cents int not null default 0 check (points_redeemed_cents >= 0),
  points_earned int not null default 0 check (points_earned >= 0),
  seller_escrow_cents int not null default 0 check (seller_escrow_cents >= 0),
  platform_escrow_cents int not null default 0 check (platform_escrow_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_order_item_settlements_order_idx
  on public.shop_order_item_settlements (order_id);

alter table public.shop_order_settlements enable row level security;
alter table public.shop_order_item_settlements enable row level security;

-- Reads for the customer and shop owner; writes stay on the service-role payment worker.
drop policy if exists shop_order_settlements_read on public.shop_order_settlements;
create policy shop_order_settlements_read on public.shop_order_settlements
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.shop_orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or public.is_shop_owner(o.seller_shop_id))
    )
  );

drop policy if exists shop_order_item_settlements_read on public.shop_order_item_settlements;
create policy shop_order_item_settlements_read on public.shop_order_item_settlements
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.shop_orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or public.is_shop_owner(o.seller_shop_id))
    )
  );

notify pgrst, 'reload schema';
