-- Link from brand PDP "Eligible retailers" logos to retailer product pages

alter table public.shop_product_offers
  add column if not exists product_page_url text default '';

comment on column public.shop_product_offers.product_page_url is
  'Public URL for this retailer\'s page for the product (logo target on brand PDP)';

notify pgrst, 'reload schema';
