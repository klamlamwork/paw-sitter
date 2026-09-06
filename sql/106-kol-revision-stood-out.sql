-- Optional ticks belong to the community post revision, not the shop product.
-- Available options are read live from each linked product's product_type.

alter table public.shop_kol_post_revisions
  add column if not exists stood_out jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
