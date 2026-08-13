-- C2: shopping cart (logged-in users). Guests use localStorage until login.

create table if not exists public.shop_carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.shop_carts (id) on delete cascade,
  product_id uuid not null references public.shop_products (id) on delete cascade,
  variant_id uuid references public.shop_product_variants (id) on delete cascade,
  shop_id uuid not null references public.shop_shops (id) on delete cascade,
  qty int not null default 1 check (qty > 0 and qty <= 99),
  price_cents int,
  currency text not null default 'CAD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id, variant_id)
);

create index if not exists shop_cart_items_cart_idx on public.shop_cart_items (cart_id);

alter table public.shop_carts enable row level security;
alter table public.shop_cart_items enable row level security;

grant select, insert, update, delete on public.shop_carts to authenticated;
grant select, insert, update, delete on public.shop_cart_items to authenticated;

create or replace function public.is_my_cart(p_cart_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_carts c
    where c.id = p_cart_id and c.user_id = auth.uid()
  );
$$;

revoke all on function public.is_my_cart(uuid) from public;
grant execute on function public.is_my_cart(uuid) to authenticated;

drop policy if exists shop_carts_owner on public.shop_carts;
create policy shop_carts_owner on public.shop_carts
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists shop_cart_items_owner on public.shop_cart_items;
create policy shop_cart_items_owner on public.shop_cart_items
  for all
  using (public.is_my_cart(cart_id) or public.is_admin())
  with check (public.is_my_cart(cart_id) or public.is_admin());

notify pgrst, 'reload schema';
