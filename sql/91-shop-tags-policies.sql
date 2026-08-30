-- KOL Phase 2: owner tag policies, blog tag sync, product-type seeds.

insert into public.shop_tags (name, slug, description)
select x.name, x.slug, ''
from (values
  ('Food', 'food'),
  ('Treats', 'treats'),
  ('Supplements', 'supplements'),
  ('Litter', 'litter'),
  ('Bowls', 'bowls'),
  ('Beds', 'beds'),
  ('Toys', 'toys'),
  ('Grooming', 'grooming'),
  ('Apparel', 'apparel')
) as x(name, slug)
on conflict (slug) do nothing;

insert into public.shop_tags (name, slug, description)
select b.name, b.slug, ''
from public.blog_tags b
on conflict (slug) do nothing;

insert into public.shop_product_tags (product_id, tag_id)
select p.id, t.id
from public.shop_products p
join public.shop_tags t on t.slug = p.product_type
where p.product_type is not null
on conflict do nothing;

drop policy if exists shop_tags_owner_insert on public.shop_tags;
create policy shop_tags_owner_insert on public.shop_tags
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.shop_shops s where s.owner_profile_id = auth.uid())
  );

drop policy if exists shop_product_tags_owner on public.shop_product_tags;
create policy shop_product_tags_owner on public.shop_product_tags
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = product_id
        and (public.is_shop_owner(p.primary_shop_id) or public.is_shop_owner(p.brand_shop_id))
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.shop_products p
      where p.id = product_id
        and (public.is_shop_owner(p.primary_shop_id) or public.is_shop_owner(p.brand_shop_id))
    )
  );

notify pgrst, 'reload schema';
