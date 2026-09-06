-- Undo 104 if it was applied. Community posts inherit /shop filters live from linked products.

alter table public.shop_kol_post_products
  drop column if exists brand_shop_id,
  drop column if exists product_type,
  drop column if exists category_ids,
  drop column if exists category_row1_ids,
  drop column if exists category_row2_ids,
  drop column if exists longevity_labels;

notify pgrst, 'reload schema';
