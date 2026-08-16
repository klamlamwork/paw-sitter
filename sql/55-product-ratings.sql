-- Product ratings: delivered orders can leave a verified review with category ticks

alter table public.shop_orders drop constraint if exists shop_orders_status_check;

create table if not exists public.shop_rating_options (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.shop_categories (id) on delete cascade,
  label text not null,
  description text,
  icon_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products (id) on delete cascade,
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  order_item_id uuid not null unique references public.shop_order_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  title text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_product_review_ticks (
  review_id uuid not null references public.shop_product_reviews (id) on delete cascade,
  option_id uuid not null references public.shop_rating_options (id) on delete cascade,
  primary key (review_id, option_id)
);

create index if not exists shop_rating_options_category_idx on public.shop_rating_options (category_id, sort_order);
create index if not exists shop_product_reviews_product_idx on public.shop_product_reviews (product_id, created_at desc);

alter table public.shop_rating_options enable row level security;
alter table public.shop_product_reviews enable row level security;
alter table public.shop_product_review_ticks enable row level security;

drop policy if exists shop_rating_options_select on public.shop_rating_options;
create policy shop_rating_options_select on public.shop_rating_options for select using (true);
drop policy if exists shop_rating_options_admin on public.shop_rating_options;
create policy shop_rating_options_admin on public.shop_rating_options for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists shop_product_reviews_select on public.shop_product_reviews;
create policy shop_product_reviews_select on public.shop_product_reviews for select using (true);
drop policy if exists shop_product_reviews_insert on public.shop_product_reviews;
create policy shop_product_reviews_insert on public.shop_product_reviews for insert with check (user_id = auth.uid());

drop policy if exists shop_product_review_ticks_select on public.shop_product_review_ticks;
create policy shop_product_review_ticks_select on public.shop_product_review_ticks for select using (true);
drop policy if exists shop_product_review_ticks_insert on public.shop_product_review_ticks;
create policy shop_product_review_ticks_insert on public.shop_product_review_ticks
  for insert with check (
    exists (select 1 from public.shop_product_reviews r where r.id = review_id and r.user_id = auth.uid())
  );

insert into storage.buckets (id, name, public)
values ('shop-rating-icons', 'shop-rating-icons', true)
on conflict (id) do nothing;

drop policy if exists shop_rating_icons_read on storage.objects;
create policy shop_rating_icons_read on storage.objects for select using (bucket_id = 'shop-rating-icons');
drop policy if exists shop_rating_icons_write on storage.objects;
create policy shop_rating_icons_write on storage.objects for insert to authenticated with check (bucket_id = 'shop-rating-icons');

notify pgrst, 'reload schema';
