-- Unify: only shops. Product brand = shop flag. Offers = who sells a product.
-- Run after sql/20-shop-core.sql

-- 1) Shop: product-brand flag (replaces separate shop_brands create flow)
alter table public.shop_shops
  add column if not exists is_product_brand boolean not null default false;

update public.shop_shops
set is_product_brand = true
where shop_type = 'brand' and is_product_brand = false;

-- 2) Migrate legacy shop_brands → shops (if any brands exist without a shop)
insert into public.shop_shops (
  name, slug, shop_type, brand_id, logo_url, description,
  seo_title, seo_description, status, is_product_brand, updated_at
)
select
  b.name,
  b.slug,
  'brand',
  b.id,
  b.logo_url,
  b.description,
  b.seo_title,
  b.seo_description,
  'active',
  true,
  now()
from public.shop_brands b
where not exists (
  select 1 from public.shop_shops s
  where s.brand_id = b.id or s.slug = b.slug
)
on conflict (slug) do update
set
  is_product_brand = true,
  shop_type = 'brand',
  brand_id = coalesce(public.shop_shops.brand_id, excluded.brand_id),
  updated_at = now();

update public.shop_shops s
set is_product_brand = true, shop_type = 'brand', updated_at = now()
where s.brand_id is not null and s.is_product_brand = false;

-- 3) Products: brand is a product-brand shop
alter table public.shop_products
  add column if not exists brand_shop_id uuid references public.shop_shops (id) on delete set null;

update public.shop_products p
set brand_shop_id = s.id
from public.shop_shops s
where p.brand_shop_id is null
  and p.brand_id is not null
  and s.brand_id = p.brand_id;

update public.shop_products p
set brand_shop_id = p.primary_shop_id
from public.shop_shops s
where p.brand_shop_id is null
  and p.primary_shop_id = s.id
  and s.is_product_brand = true;

create index if not exists shop_products_brand_shop_idx
  on public.shop_products (brand_shop_id);

create index if not exists shop_shops_is_product_brand_idx
  on public.shop_shops (is_product_brand)
  where is_product_brand = true;

-- 4) Offers: product available at a shop (brand DTC or any retailer)
create table if not exists public.shop_product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products (id) on delete cascade,
  shop_id uuid not null references public.shop_shops (id) on delete cascade,
  price_cents int,
  currency text not null default 'CAD',
  hide_price boolean not null default false,
  show_affiliate boolean not null default false,
  show_add_to_cart boolean not null default false,
  affiliate_url text default '',
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'archived')),
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, shop_id)
);

create index if not exists shop_product_offers_product_idx
  on public.shop_product_offers (product_id);
create index if not exists shop_product_offers_shop_idx
  on public.shop_product_offers (shop_id);
create index if not exists shop_product_offers_status_idx
  on public.shop_product_offers (status);

insert into public.shop_product_offers (
  product_id, shop_id, price_cents, currency, hide_price,
  show_affiliate, show_add_to_cart, affiliate_url, status, is_default, updated_at
)
select
  ps.product_id,
  ps.shop_id,
  p.price_cents,
  coalesce(p.currency, 'CAD'),
  coalesce(p.hide_price, false),
  coalesce(p.show_affiliate, false),
  coalesce(p.show_add_to_cart, false),
  coalesce(p.affiliate_url, ''),
  case when p.status = 'approved' then 'approved' else 'draft' end,
  (p.primary_shop_id is not null and p.primary_shop_id = ps.shop_id),
  now()
from public.shop_product_shops ps
join public.shop_products p on p.id = ps.product_id
on conflict (product_id, shop_id) do nothing;

insert into public.shop_product_offers (
  product_id, shop_id, price_cents, currency, hide_price,
  show_affiliate, show_add_to_cart, affiliate_url, status, is_default, updated_at
)
select
  p.id,
  p.primary_shop_id,
  p.price_cents,
  coalesce(p.currency, 'CAD'),
  coalesce(p.hide_price, false),
  coalesce(p.show_affiliate, false),
  coalesce(p.show_add_to_cart, false),
  coalesce(p.affiliate_url, ''),
  case when p.status = 'approved' then 'approved' else 'draft' end,
  true,
  now()
from public.shop_products p
where p.primary_shop_id is not null
on conflict (product_id, shop_id) do nothing;

alter table public.shop_product_offers enable row level security;

drop policy if exists shop_product_offers_public_select on public.shop_product_offers;
create policy shop_product_offers_public_select on public.shop_product_offers
  for select using (status = 'approved' or public.is_admin());

drop policy if exists shop_product_offers_admin on public.shop_product_offers;
create policy shop_product_offers_admin on public.shop_product_offers
  for all using (public.is_admin()) with check (public.is_admin());

-- shop_brands kept temporarily for old FKs; app no longer creates brands separately.

notify pgrst, 'reload schema';
