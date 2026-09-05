alter table public.shop_kol_post_media add column if not exists caption text not null default '';
alter table public.shop_kol_post_media add column if not exists is_cover boolean not null default false;
alter table public.shop_kol_post_media add column if not exists product_id uuid references public.shop_products (id) on delete set null;
alter table public.shop_kol_post_products add column if not exists description text not null default '';
alter table public.shop_kol_post_revisions add column if not exists key_takeaways jsonb not null default '[]'::jsonb;
create index if not exists shop_kol_post_media_product_idx on public.shop_kol_post_media (product_id);
notify pgrst, 'reload schema';
