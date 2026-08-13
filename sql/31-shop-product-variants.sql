-- Product varieties + stock (shop-managed; no admin approval required)

create table if not exists public.shop_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products (id) on delete cascade,
  -- Shop that owns/manages this variety stock (usually primary_shop)
  shop_id uuid not null references public.shop_shops (id) on delete cascade,
  name text not null,
  sku text default '',
  -- null = use parent product price
  price_cents int,
  currency text not null default 'CAD',
  stock_qty int not null default 0,
  track_stock boolean not null default true,
  -- show on public PDP
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_product_variants_product_idx
  on public.shop_product_variants (product_id, sort_order);
create index if not exists shop_product_variants_shop_idx
  on public.shop_product_variants (shop_id);

alter table public.shop_product_variants enable row level security;

-- Public: active variants on approved products
drop policy if exists shop_variants_public_select on public.shop_product_variants;
create policy shop_variants_public_select on public.shop_product_variants
  for select using (
    is_active = true
    and exists (
      select 1 from public.shop_products p
      where p.id = shop_product_variants.product_id
        and p.status = 'approved'
    )
    or public.is_admin()
    or public.is_shop_owner(shop_id)
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_variants.product_id
        and (
          public.is_shop_owner(p.brand_shop_id)
          or public.is_shop_owner(p.primary_shop_id)
        )
    )
  );

-- Shop owners manage variants directly (no pending approval)
drop policy if exists shop_variants_owner_write on public.shop_product_variants;
create policy shop_variants_owner_write on public.shop_product_variants
  for all
  using (
    public.is_admin()
    or public.is_shop_owner(shop_id)
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_variants.product_id
        and (
          public.is_shop_owner(p.brand_shop_id)
          or public.is_shop_owner(p.primary_shop_id)
        )
    )
  )
  with check (
    public.is_admin()
    or public.is_shop_owner(shop_id)
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_variants.product_id
        and (
          public.is_shop_owner(p.brand_shop_id)
          or public.is_shop_owner(p.primary_shop_id)
        )
    )
  );

notify pgrst, 'reload schema';
