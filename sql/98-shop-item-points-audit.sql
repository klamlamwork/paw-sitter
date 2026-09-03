-- Auditable item-level Paw Points allocation for shop refunds.
-- Schema only: this migration does not alter checkout, ledger behavior, webhooks, or UI.
-- Run after sql/96-shop-order-item-refunds.sql and sql/97-shop-order-item-refund-qty.sql.

alter table public.paw_point_ledger
  add column if not exists order_item_id uuid references public.shop_order_items (id) on delete set null;

alter table public.shop_order_items
  add column if not exists refunded_points int not null default 0;

create table if not exists public.shop_order_item_point_awards (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  order_item_id uuid not null unique references public.shop_order_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  earned_points int not null default 0 check (earned_points >= 0),
  awarded_net_cents int not null default 0 check (awarded_net_cents >= 0),
  product_type text not null default 'other',
  pending_ledger_id uuid references public.paw_point_ledger (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_order_item_point_awards_order_idx
  on public.shop_order_item_point_awards (order_id);
create index if not exists shop_order_item_point_awards_user_idx
  on public.shop_order_item_point_awards (user_id, created_at desc);

create table if not exists public.shop_order_item_refund_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  order_item_id uuid not null references public.shop_order_items (id) on delete cascade,
  stripe_refund_id text unique,
  refund_qty int not null check (refund_qty > 0),
  refund_cents int not null check (refund_cents >= 0),
  clawed_points int not null default 0 check (clawed_points >= 0),
  clawback_ledger_id uuid references public.paw_point_ledger (id) on delete set null,
  source text not null default 'seller_item_refund' check (source in ('seller_item_refund', 'seller_decline', 'stripe_webhook', 'admin_repair')),
  created_at timestamptz not null default now(),
  unique (order_item_id, stripe_refund_id)
);

create index if not exists shop_order_item_refund_events_order_idx
  on public.shop_order_item_refund_events (order_id, created_at desc);

alter table public.shop_order_item_point_awards enable row level security;
alter table public.shop_order_item_refund_events enable row level security;

-- Customer can read their own audit records; seller/admin write remains server-side
-- through the service-role refund worker in the next batch.
drop policy if exists shop_order_item_point_awards_read on public.shop_order_item_point_awards;
create policy shop_order_item_point_awards_read on public.shop_order_item_point_awards
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.shop_orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists shop_order_item_refund_events_read on public.shop_order_item_refund_events;
create policy shop_order_item_refund_events_read on public.shop_order_item_refund_events
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.shop_orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_shop_owner(o.seller_shop_id))
    )
  );

notify pgrst, 'reload schema';
