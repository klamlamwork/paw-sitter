-- Products can belong to multiple categories (including subcategories)

create table if not exists public.shop_product_categories (
  product_id uuid not null references public.shop_products (id) on delete cascade,
  category_id uuid not null references public.shop_categories (id) on delete cascade,
  primary key (product_id, category_id)
);

create index if not exists shop_product_categories_category_idx
  on public.shop_product_categories (category_id);

-- Backfill from single category_id
insert into public.shop_product_categories (product_id, category_id)
select id, category_id
from public.shop_products
where category_id is not null
on conflict do nothing;

alter table public.shop_product_categories enable row level security;

drop policy if exists shop_product_categories_public_select on public.shop_product_categories;
create policy shop_product_categories_public_select on public.shop_product_categories
  for select using (true);

drop policy if exists shop_product_categories_admin on public.shop_product_categories;
create policy shop_product_categories_admin on public.shop_product_categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists shop_product_categories_owner on public.shop_product_categories;
create policy shop_product_categories_owner on public.shop_product_categories
  for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_categories.product_id
        and (
          public.is_shop_owner(p.brand_shop_id)
          or public.is_shop_owner(p.primary_shop_id)
        )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_categories.product_id
        and (
          public.is_shop_owner(p.brand_shop_id)
          or public.is_shop_owner(p.primary_shop_id)
        )
    )
  );

notify pgrst, 'reload schema';
