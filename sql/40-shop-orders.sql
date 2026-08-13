-- C3-3: per-seller orders created from cart at checkout

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  seller_shop_id uuid not null references public.shop_shops (id) on delete cascade,
  status text not null default 'pending',
  shipping_name text,
  shipping_email text,
  shipping_phone text,
  shipping_line1 text,
  shipping_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_postal_code text,
  shipping_country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  product_id uuid not null references public.shop_products (id) on delete restrict,
  variant_id uuid references public.shop_product_variants (id) on delete restrict,
  seller_shop_id uuid not null references public.shop_shops (id) on delete restrict,
  qty int not null check (qty > 0 and qty <= 99),
  price_cents int,
  currency text not null default 'CAD',
  created_at timestamptz not null default now()
);

create index if not exists shop_orders_user_idx on public.shop_orders (user_id);
create index if not exists shop_orders_seller_idx on public.shop_orders (seller_shop_id);
create index if not exists shop_order_items_order_idx on public.shop_order_items (order_id);

alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;

grant select, insert, update, delete on public.shop_orders to authenticated;
grant select, insert, update, delete on public.shop_order_items to authenticated;

drop policy if exists shop_orders_owner on public.shop_orders;
create policy shop_orders_owner on public.shop_orders
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists shop_order_items_owner on public.shop_order_items;
create policy shop_order_items_owner on public.shop_order_items
  for all
  using ((select user_id from public.shop_orders where id = order_id) = auth.uid() or public.is_admin())
  with check ((select user_id from public.shop_orders where id = order_id) = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';
