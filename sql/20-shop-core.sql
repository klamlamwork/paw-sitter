-- Paw Sitter Shop Phase 1A — core multi-shop catalog
-- Storefronts: /shop/shops/[slug] (not /vendors)
-- Brands: /shop/brands/[slug]
-- Products: /shop/p/[slug]

-- Shops = vendors (sellers). Brands may also be shops (is_brand / brand_id).
create table if not exists public.shop_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text default '',
  description text default '',
  seo_title text default '',
  seo_description text default '',
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_shops (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles (id) on delete set null,
  name text not null,
  slug text not null unique,
  shop_type text not null default 'vendor' check (shop_type in ('vendor', 'brand')),
  brand_id uuid references public.shop_brands (id) on delete set null,
  logo_url text default '',
  description text default '',
  seo_title text default '',
  seo_description text default '',
  status text not null default 'active' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.shop_categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text default '',
  seo_title text default '',
  seo_description text default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text default '',
  description text default '',
  longevity_blurb text default '',
  category_id uuid references public.shop_categories (id) on delete set null,
  brand_id uuid references public.shop_brands (id) on delete set null,
  primary_shop_id uuid references public.shop_shops (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'archived')),
  species text[] not null default '{}',
  life_stages text[] not null default '{}',
  longevity_tags text[] not null default '{}',
  price_cents int,
  currency text not null default 'CAD',
  hide_price boolean not null default false,
  show_affiliate boolean not null default false,
  show_add_to_cart boolean not null default false,
  affiliate_url text default '',
  seo_title text default '',
  seo_description text default '',
  created_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products (id) on delete cascade,
  url text not null,
  alt_text text default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_product_shops (
  product_id uuid not null references public.shop_products (id) on delete cascade,
  shop_id uuid not null references public.shop_shops (id) on delete cascade,
  primary key (product_id, shop_id)
);

create table if not exists public.shop_related_products (
  product_id uuid not null references public.shop_products (id) on delete cascade,
  related_product_id uuid not null references public.shop_products (id) on delete cascade,
  sort_order int not null default 0,
  primary key (product_id, related_product_id),
  check (product_id <> related_product_id)
);

create table if not exists public.shop_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  rating int not null check (rating >= 1 and rating <= 5),
  title text default '',
  body text default '',
  verified_purchase boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists shop_products_status_idx on public.shop_products (status);
create index if not exists shop_products_category_idx on public.shop_products (category_id);
create index if not exists shop_products_brand_idx on public.shop_products (brand_id);
create index if not exists shop_products_slug_idx on public.shop_products (slug);
create index if not exists shop_shops_slug_idx on public.shop_shops (slug);
create index if not exists shop_brands_slug_idx on public.shop_brands (slug);

-- RLS
alter table public.shop_brands enable row level security;
alter table public.shop_shops enable row level security;
alter table public.shop_categories enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_product_media enable row level security;
alter table public.shop_product_shops enable row level security;
alter table public.shop_related_products enable row level security;
alter table public.shop_reviews enable row level security;

-- Public read
drop policy if exists shop_brands_public_select on public.shop_brands;
create policy shop_brands_public_select on public.shop_brands for select using (true);

drop policy if exists shop_shops_public_select on public.shop_shops;
create policy shop_shops_public_select on public.shop_shops for select using (status = 'active');

drop policy if exists shop_categories_public_select on public.shop_categories;
create policy shop_categories_public_select on public.shop_categories for select using (true);

drop policy if exists shop_products_public_select on public.shop_products;
create policy shop_products_public_select on public.shop_products
  for select using (status = 'approved' or public.is_admin());

drop policy if exists shop_product_media_public_select on public.shop_product_media;
create policy shop_product_media_public_select on public.shop_product_media for select using (true);

drop policy if exists shop_product_shops_public_select on public.shop_product_shops;
create policy shop_product_shops_public_select on public.shop_product_shops for select using (true);

drop policy if exists shop_related_public_select on public.shop_related_products;
create policy shop_related_public_select on public.shop_related_products for select using (true);

drop policy if exists shop_reviews_public_select on public.shop_reviews;
create policy shop_reviews_public_select on public.shop_reviews
  for select using (status = 'approved' or public.is_admin());

-- Admin write
drop policy if exists shop_brands_admin on public.shop_brands;
create policy shop_brands_admin on public.shop_brands for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists shop_shops_admin on public.shop_shops;
create policy shop_shops_admin on public.shop_shops for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists shop_categories_admin on public.shop_categories;
create policy shop_categories_admin on public.shop_categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists shop_products_admin on public.shop_products;
create policy shop_products_admin on public.shop_products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists shop_product_media_admin on public.shop_product_media;
create policy shop_product_media_admin on public.shop_product_media for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists shop_product_shops_admin on public.shop_product_shops;
create policy shop_product_shops_admin on public.shop_product_shops for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists shop_related_admin on public.shop_related_products;
create policy shop_related_admin on public.shop_related_products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists shop_reviews_admin on public.shop_reviews;
create policy shop_reviews_admin on public.shop_reviews for all using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
