-- Multiple longevity chips per product: circle icon + keywords
-- Run after shop owner RLS (22/23)

create table if not exists public.shop_product_longevity_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products (id) on delete cascade,
  icon_key text not null default 'heart',
  label text not null,
  note text default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists shop_product_longevity_product_idx
  on public.shop_product_longevity_items (product_id, sort_order);

alter table public.shop_product_longevity_items enable row level security;

drop policy if exists shop_longevity_public_select on public.shop_product_longevity_items;
create policy shop_longevity_public_select on public.shop_product_longevity_items
  for select using (
    exists (
      select 1 from public.shop_products p
      where p.id = shop_product_longevity_items.product_id
        and (p.status = 'approved' or public.is_admin()
          or public.is_shop_owner(p.brand_shop_id)
          or public.is_shop_owner(p.primary_shop_id))
    )
  );

drop policy if exists shop_longevity_owner_write on public.shop_product_longevity_items;
create policy shop_longevity_owner_write on public.shop_product_longevity_items
  for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = shop_product_longevity_items.product_id
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
      where p.id = shop_product_longevity_items.product_id
        and (
          public.is_shop_owner(p.brand_shop_id)
          or public.is_shop_owner(p.primary_shop_id)
        )
    )
  );

notify pgrst, 'reload schema';
