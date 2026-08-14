-- Admin-defined Longevity highlights. Shops pick from this list only.

create table if not exists public.shop_longevity_highlights (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  note text default '',
  icon_key text not null default 'heart',
  icon_url text default '',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_longevity_highlights_sort_idx
  on public.shop_longevity_highlights (is_active, sort_order, label);

alter table public.shop_product_longevity_items
  add column if not exists highlight_id uuid references public.shop_longevity_highlights (id) on delete set null;

alter table public.shop_longevity_highlights enable row level security;

drop policy if exists shop_longevity_highlights_public_select on public.shop_longevity_highlights;
create policy shop_longevity_highlights_public_select on public.shop_longevity_highlights
  for select using (is_active = true or public.is_admin());

drop policy if exists shop_longevity_highlights_admin on public.shop_longevity_highlights;
create policy shop_longevity_highlights_admin on public.shop_longevity_highlights
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.shop_longevity_highlights (label, icon_key, sort_order)
select v.label, v.icon_key, v.sort_order
from (values
  ('Heart', 'heart', 1),
  ('Natural', 'leaf', 2),
  ('Joints', 'bone', 3),
  ('Cognition', 'brain', 4),
  ('Immune', 'shield', 5),
  ('Hydration', 'drop', 6),
  ('Vitality', 'sun', 7),
  ('Mobility', 'paw', 8),
  ('Omega', 'fish', 9),
  ('Glow', 'sparkle', 10),
  ('Aging', 'clock', 11),
  ('Quality', 'star', 12)
) as v(label, icon_key, sort_order)
where not exists (select 1 from public.shop_longevity_highlights h where h.label = v.label);

insert into storage.buckets (id, name, public)
values ('shop-longevity-icons', 'shop-longevity-icons', true)
on conflict (id) do nothing;

drop policy if exists shop_longevity_icons_public_read on storage.objects;
create policy shop_longevity_icons_public_read on storage.objects
  for select using (bucket_id = 'shop-longevity-icons');

drop policy if exists shop_longevity_icons_admin_write on storage.objects;
create policy shop_longevity_icons_admin_write on storage.objects
  for all
  using (bucket_id = 'shop-longevity-icons' and public.is_admin())
  with check (bucket_id = 'shop-longevity-icons' and public.is_admin());

notify pgrst, 'reload schema';
