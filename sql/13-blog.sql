create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  headline text not null,
  content_html text not null default '',
  published boolean not null default false,
  published_at timestamptz,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.blog_post_tags (
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  tag_id uuid not null references public.blog_tags (id) on delete cascade,
  primary key (post_id, tag_id)
);
create table if not exists public.blog_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  image_url text default '',
  url text not null default '#',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.blog_post_products (
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  product_id uuid not null references public.blog_products (id) on delete cascade,
  sort_order int not null default 0,
  primary key (post_id, product_id)
);
create table if not exists public.blog_post_related (
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  related_post_id uuid not null references public.blog_posts (id) on delete cascade,
  sort_order int not null default 0,
  primary key (post_id, related_post_id),
  check (post_id <> related_post_id)
);
create index if not exists blog_posts_published_idx on public.blog_posts (published, published_at desc);
alter table public.blog_tags enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_post_tags enable row level security;
alter table public.blog_products enable row level security;
alter table public.blog_post_products enable row level security;
alter table public.blog_post_related enable row level security;
drop policy if exists blog_tags_select on public.blog_tags;
create policy blog_tags_select on public.blog_tags for select using (true);
drop policy if exists blog_posts_select on public.blog_posts;
create policy blog_posts_select on public.blog_posts for select using (published = true or public.is_admin());
drop policy if exists blog_post_tags_select on public.blog_post_tags;
create policy blog_post_tags_select on public.blog_post_tags for select using (true);
drop policy if exists blog_products_select on public.blog_products;
create policy blog_products_select on public.blog_products for select using (is_active = true or public.is_admin());
drop policy if exists blog_post_products_select on public.blog_post_products;
create policy blog_post_products_select on public.blog_post_products for select using (true);
drop policy if exists blog_post_related_select on public.blog_post_related;
create policy blog_post_related_select on public.blog_post_related for select using (true);
drop policy if exists blog_tags_admin on public.blog_tags;
create policy blog_tags_admin on public.blog_tags for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists blog_posts_admin on public.blog_posts;
create policy blog_posts_admin on public.blog_posts for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists blog_post_tags_admin on public.blog_post_tags;
create policy blog_post_tags_admin on public.blog_post_tags for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists blog_products_admin on public.blog_products;
create policy blog_products_admin on public.blog_products for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists blog_post_products_admin on public.blog_post_products;
create policy blog_post_products_admin on public.blog_post_products for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists blog_post_related_admin on public.blog_post_related;
create policy blog_post_related_admin on public.blog_post_related for all using (public.is_admin()) with check (public.is_admin());
