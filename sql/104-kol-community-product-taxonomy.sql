-- Snapshot /shop filter taxonomy onto each community KOL product link.
-- Does not change shop_tags, blog tags, Rate now, or /shop product filters.

alter table public.shop_kol_post_products
  add column if not exists brand_shop_id uuid references public.shop_shops (id) on delete set null,
  add column if not exists product_type text not null default 'other',
  add column if not exists category_ids uuid[] not null default '{}',
  add column if not exists category_row1_ids uuid[] not null default '{}',
  add column if not exists category_row2_ids uuid[] not null default '{}',
  add column if not exists longevity_labels text[] not null default '{}';

notify pgrst, 'reload schema';
