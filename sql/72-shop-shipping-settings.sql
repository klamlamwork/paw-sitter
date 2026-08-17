-- File: sql/72-shop-shipping-settings.sql
-- Shop-level shipping settings (one row per shop)
create table if not exists public.shop_shipping_settings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null unique references public.shop_shops(id) on delete cascade,

  -- Fulfillment location used for Home vs National logic
  fulfillment_province text not null, -- e.g. "ON", "BC", "CA-ON", "CA-BC"

  -- National (domestic out-of-province) control
  allow_national boolean not null default true,
  national_regions jsonb not null default '[]'::jsonb, -- ["CA-AB","CA-BC",...]

  -- US cross-border control
  ship_to_us boolean not null default false,

  -- Excluded regions (applies to all methods). Supports wildcards like "US-*".
  exclude_regions jsonb not null default '[]'::jsonb,

  -- Standard method
  standard_home_flat_cents int not null default 0,
  standard_home_min_days int not null default 3,
  standard_home_max_days int not null default 7,
  standard_home_free_over_cents int,

  standard_national_flat_cents int not null default 0,
  standard_national_min_days int not null default 5,
  standard_national_max_days int not null default 10,
  standard_national_free_over_cents int,

  standard_us_flat_cents int not null default 0,
  standard_us_min_days int not null default 7,
  standard_us_max_days int not null default 14,
  standard_us_free_over_cents int,

  -- Express method
  express_enabled boolean not null default false,
  express_rate_mode text not null default 'flat' check (express_rate_mode in ('flat','surcharge')),
  express_surcharge_cents int not null default 0,

  express_home_flat_cents int not null default 0,
  express_home_min_days int not null default 1,
  express_home_max_days int not null default 3,
  express_home_free_over_cents int,

  express_national_flat_cents int not null default 0,
  express_national_min_days int not null default 2,
  express_national_max_days int not null default 5,
  express_national_free_over_cents int,

  express_us_flat_cents int not null default 0,
  express_us_min_days int not null default 5,
  express_us_max_days int not null default 10,
  express_us_free_over_cents int,

  -- Pickup method
  pickup_enabled boolean not null default false,
  pickup_ready_hours int not null default 24,
  pickup_home_flat_cents int not null default 0,
  pickup_national_flat_cents int not null default 0,
  pickup_us_flat_cents int not null default 0,

  updated_at timestamptz not null default now()
);

create index if not exists shop_shipping_settings_shop_idx on public.shop_shipping_settings (shop_id);

alter table public.shop_shipping_settings enable row level security;

grant select on public.shop_shipping_settings to authenticated;
grant insert, update, delete on public.shop_shipping_settings to authenticated;

drop policy if exists shop_shipping_settings_select on public.shop_shipping_settings;
create policy shop_shipping_settings_select on public.shop_shipping_settings
  for select
  using (
    public.is_admin()
    or public.is_shop_owner(shop_id)
  );

drop policy if exists shop_shipping_settings_mod on public.shop_shipping_settings;
create policy shop_shipping_settings_mod on public.shop_shipping_settings
  for all
  using ( public.is_shop_owner(shop_id) )
  with check ( public.is_shop_owner(shop_id) );

-- Per-product/variety shipping overrides
create table if not exists public.shop_shipping_offers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shop_shops(id) on delete cascade,
  product_id uuid references public.shop_products(id) on delete cascade,
  variant_id uuid references public.shop_product_variants(id) on delete cascade,
  method text not null check (method in ('standard','express','pickup')),

  -- Regional flats
  home_flat_cents int not null default 0,
  national_flat_cents int not null default 0,
  us_flat_cents int not null default 0,

  -- Thresholds
  home_free_over_cents int,
  national_free_over_cents int,
  us_free_over_cents int,

  -- Express surcharge (only used when method='express' and shop uses surcharge mode)
  surcharge_cents int not null default 0,

  unique (shop_id, product_id, variant_id, method),
  constraint one_of_product_or_variant check (
    (product_id is not null and variant_id is null)
    or (product_id is null and variant_id is not null)
    or (product_id is not null and variant_id is not null)
  ),
  updated_at timestamptz not null default now()
);

create index if not exists shop_shipping_offers_shop_idx on public.shop_shipping_offers (shop_id);
create index if not exists shop_shipping_offers_product_idx on public.shop_shipping_offers (product_id);
create index if not exists shop_shipping_offers_variant_idx on public.shop_shipping_offers (variant_id);

alter table public.shop_shipping_offers enable row level security;

grant select on public.shop_shipping_offers to authenticated;
grant insert, update, delete on public.shop_shipping_offers to authenticated;

drop policy if exists shop_shipping_offers_select on public.shop_shipping_offers;
create policy shop_shipping_offers_select on public.shop_shipping_offers
  for select
  using (
    public.is_admin()
    or public.is_shop_owner(shop_id)
  );

drop policy if exists shop_shipping_offers_mod on public.shop_shipping_offers;
create policy shop_shipping_offers_mod on public.shop_shipping_offers
  for all
  using ( public.is_shop_owner(shop_id) )
  with check ( public.is_shop_owner(shop_id) );

-- Snapshot shipping fields on shop_orders (add if missing)
alter table public.shop_orders
  add column if not exists shipping_method text,
  add column if not exists shipping_cents int not null default 0,
  add column if not exists shipping_label text,
  add column if not exists pickup_location text,
  add column if not exists pickup_ready_by timestamptz;

comment on column public.shop_orders.shipping_method is 'standard | express | pickup';
comment on column public.shop_orders.shipping_cents is 'Snapshot of shipping charge at checkout';
comment on column public.shop_orders.shipping_label is 'Human label e.g. "Standard · 3–7 business days"';
comment on column public.shop_orders.pickup_location is 'Pickup address text snapshot';
comment on column public.shop_orders.pickup_ready_by is 'Ready-by timestamp for pickup';

notify pgrst, 'reload schema';
