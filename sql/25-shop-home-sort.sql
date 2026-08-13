-- Display order on /shop/ for Shop by brand and Retailers sections

alter table public.shop_shops
  add column if not exists home_brand_sort int;

alter table public.shop_shops
  add column if not exists home_retailer_sort int;

comment on column public.shop_shops.home_brand_sort is
  '1-10 order in /shop/ Shop by brand; null = not prioritized';
comment on column public.shop_shops.home_retailer_sort is
  '1-10 order in /shop/ Retailers; null = not prioritized';

create index if not exists shop_shops_home_brand_sort_idx
  on public.shop_shops (home_brand_sort)
  where home_brand_sort is not null;

create index if not exists shop_shops_home_retailer_sort_idx
  on public.shop_shops (home_retailer_sort)
  where home_retailer_sort is not null;

notify pgrst, 'reload schema';
