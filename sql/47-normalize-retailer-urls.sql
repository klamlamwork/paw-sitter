-- Prefix https:// on retailer product URLs that were saved without a scheme.
-- Skip values that are already http(s) or an on-site path.

update public.shop_product_offers
set product_page_url = 'https://' || trim(product_page_url),
    updated_at = now()
where coalesce(trim(product_page_url), '') <> ''
  and product_page_url !~* '^https?://'
  and product_page_url !~ '^/';

notify pgrst, 'reload schema';
