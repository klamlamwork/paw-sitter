-- KOL Phase 1 foundation. Additive only. Does not alter existing review, gallery, or checkout UI.

-- 1) Shop order return / refund window
alter table public.shop_orders
  add column if not exists delivered_at timestamptz,
  add column if not exists return_window_ends_at timestamptz,
  add column if not exists return_status text not null default 'none',
  add column if not exists refund_status text not null default 'none',
  add column if not exists return_requested_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists chargeback_opened_at timestamptz;

update public.shop_orders
set return_status = 'none'
where return_status is null or return_status = '';

update public.shop_orders
set refund_status = 'none'
where refund_status is null or refund_status = '';

alter table public.shop_orders drop constraint if exists shop_orders_return_status_check;
alter table public.shop_orders
  add constraint shop_orders_return_status_check
  check (return_status in ('none', 'requested', 'approved', 'received', 'rejected'));

alter table public.shop_orders drop constraint if exists shop_orders_refund_status_check;
alter table public.shop_orders
  add constraint shop_orders_refund_status_check
  check (refund_status in ('none', 'pending', 'refunded', 'chargeback_open', 'chargeback_lost', 'chargeback_won'));

create or replace function public.shop_order_set_delivery_window()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'delivered' and (old.status is distinct from 'delivered') then
    new.delivered_at := coalesce(new.delivered_at, now());
    new.return_window_ends_at := coalesce(new.return_window_ends_at, new.delivered_at + interval '7 days');
  end if;
  return new;
end;
$$;

drop trigger if exists shop_orders_delivery_window on public.shop_orders;
create trigger shop_orders_delivery_window
  before update on public.shop_orders
  for each row execute function public.shop_order_set_delivery_window();

-- 2) Product brand name (column only; create form wired in a later phase)
alter table public.shop_products
  add column if not exists brand_name text;

-- 3) Shared tags
create table if not exists public.shop_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.shop_product_tags (
  product_id uuid not null references public.shop_products (id) on delete cascade,
  tag_id uuid not null references public.shop_tags (id) on delete cascade,
  primary key (product_id, tag_id)
);

create index if not exists shop_product_tags_tag_idx on public.shop_product_tags (tag_id);

-- 4) KOL posts + immutable revisions
create table if not exists public.shop_kol_posts (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid not null references public.profiles (id) on delete cascade,
  source_type text not null check (source_type in ('verified_purchase', 'community')),
  content_type text not null check (content_type in ('review', 'how_to', 'education')),
  status text not null default 'draft' check (status in (
    'draft', 'processing', 'pending_admin', 'published', 'rejected_auto', 'rejected_admin', 'needs_changes', 'unpublished'
  )),
  slug text unique,
  verified_order_item_id uuid references public.shop_order_items (id) on delete set null,
  primary_product_id uuid references public.shop_products (id) on delete set null,
  published_revision_id uuid,
  pending_revision_id uuid,
  verified_badge boolean not null default false,
  reward_points int not null default 0,
  reward_status text not null default 'none' check (reward_status in ('none', 'pending', 'available', 'converted_community', 'cancelled', 'clawed')),
  reward_available_at timestamptz,
  reward_source_key text unique,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_kol_post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.shop_kol_posts (id) on delete cascade,
  revision_number int not null,
  title text not null default '',
  body text not null default '',
  rating int,
  content_type text not null check (content_type in ('review', 'how_to', 'education')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'pass', 'flagged', 'fail', 'approved_admin', 'rejected_admin')),
  moderation_score numeric,
  moderation_reasons jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  unique (post_id, revision_number),
  check (rating is null or (rating >= 1 and rating <= 5))
);

alter table public.shop_kol_posts
  drop constraint if exists shop_kol_posts_published_revision_fk;
alter table public.shop_kol_posts
  add constraint shop_kol_posts_published_revision_fk
  foreign key (published_revision_id) references public.shop_kol_post_revisions (id) on delete set null;

alter table public.shop_kol_posts
  drop constraint if exists shop_kol_posts_pending_revision_fk;
alter table public.shop_kol_posts
  add constraint shop_kol_posts_pending_revision_fk
  foreign key (pending_revision_id) references public.shop_kol_post_revisions (id) on delete set null;

create table if not exists public.shop_kol_post_products (
  post_id uuid not null references public.shop_kol_posts (id) on delete cascade,
  product_id uuid not null references public.shop_products (id) on delete cascade,
  is_primary boolean not null default false,
  primary key (post_id, product_id)
);

create table if not exists public.shop_kol_post_tags (
  post_id uuid not null references public.shop_kol_posts (id) on delete cascade,
  tag_id uuid not null references public.shop_tags (id) on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.shop_kol_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.shop_kol_posts (id) on delete set null,
  revision_id uuid references public.shop_kol_post_revisions (id) on delete set null,
  public_id text not null,
  version bigint,
  resource_type text not null default 'image' check (resource_type in ('image', 'video')),
  sort_order int not null default 0,
  duration_seconds numeric,
  width int,
  height int,
  bytes int,
  phash text,
  lifecycle text not null default 'unattached' check (lifecycle in ('unattached', 'attached_private', 'published', 'deleted')),
  created_at timestamptz not null default now()
);

create table if not exists public.kol_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.shop_kol_posts (id) on delete set null,
  media_kind text not null check (media_kind in ('image', 'video')),
  status text not null default 'open' check (status in ('open', 'uploaded', 'attached', 'deleted', 'expired')),
  public_id text not null,
  folder text not null,
  resource_type text not null default 'image',
  max_bytes int not null,
  max_duration_seconds int,
  expires_at timestamptz not null,
  uploaded_at timestamptz,
  attached_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.kol_moderation_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.shop_kol_posts (id) on delete cascade,
  revision_id uuid references public.shop_kol_post_revisions (id) on delete cascade,
  stage text not null,
  decision text not null,
  reasons jsonb not null default '[]'::jsonb,
  score numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.kol_reward_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.shop_kol_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid,
  action text not null check (action in ('grant_pending', 'release_available', 'convert_community', 'cancel', 'claw')),
  points int not null,
  source_key text not null,
  ledger_id uuid,
  remark text not null default '',
  created_at timestamptz not null default now()
);

alter table public.paw_point_ledger
  add column if not exists available_at timestamptz;

create unique index if not exists paw_point_ledger_kol_source_key_idx
  on public.paw_point_ledger (source_key)
  where source_key like 'kol_post:%' and delta > 0 and reason = 'earn_kol';

create index if not exists shop_kol_posts_author_idx on public.shop_kol_posts (author_profile_id, status);
create index if not exists shop_kol_posts_status_idx on public.shop_kol_posts (status, published_at);
create index if not exists shop_kol_post_media_lifecycle_idx on public.shop_kol_post_media (lifecycle, created_at);
create index if not exists kol_upload_sessions_status_idx on public.kol_upload_sessions (status, expires_at);

alter table public.shop_tags enable row level security;
alter table public.shop_product_tags enable row level security;
alter table public.shop_kol_posts enable row level security;
alter table public.shop_kol_post_revisions enable row level security;
alter table public.shop_kol_post_products enable row level security;
alter table public.shop_kol_post_tags enable row level security;
alter table public.shop_kol_post_media enable row level security;
alter table public.kol_upload_sessions enable row level security;
alter table public.kol_moderation_events enable row level security;
alter table public.kol_reward_events enable row level security;

grant select on public.shop_tags to anon, authenticated;
grant select on public.shop_product_tags to anon, authenticated;
grant select on public.shop_kol_posts to anon, authenticated;
grant select on public.shop_kol_post_revisions to anon, authenticated;
grant select on public.shop_kol_post_products to anon, authenticated;
grant select on public.shop_kol_post_tags to anon, authenticated;
grant select on public.shop_kol_post_media to anon, authenticated;
grant select on public.kol_upload_sessions to authenticated;

drop policy if exists shop_tags_public_read on public.shop_tags;
create policy shop_tags_public_read on public.shop_tags
  for select using (status = 'active' or public.is_admin());

drop policy if exists shop_product_tags_public_read on public.shop_product_tags;
create policy shop_product_tags_public_read on public.shop_product_tags
  for select using (true);

drop policy if exists shop_kol_posts_read on public.shop_kol_posts;
create policy shop_kol_posts_read on public.shop_kol_posts
  for select using (
    status = 'published'
    or author_profile_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists shop_kol_revisions_read on public.shop_kol_post_revisions;
create policy shop_kol_revisions_read on public.shop_kol_post_revisions
  for select using (
    exists (
      select 1 from public.shop_kol_posts p
      where p.id = post_id
        and (
          p.published_revision_id = shop_kol_post_revisions.id
          or p.author_profile_id = auth.uid()
          or public.is_admin()
        )
    )
  );

drop policy if exists shop_kol_products_read on public.shop_kol_post_products;
create policy shop_kol_products_read on public.shop_kol_post_products
  for select using (
    exists (
      select 1 from public.shop_kol_posts p
      where p.id = post_id and (p.status = 'published' or p.author_profile_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists shop_kol_tags_read on public.shop_kol_post_tags;
create policy shop_kol_tags_read on public.shop_kol_post_tags
  for select using (
    exists (
      select 1 from public.shop_kol_posts p
      where p.id = post_id and (p.status = 'published' or p.author_profile_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists shop_kol_media_read on public.shop_kol_post_media;
create policy shop_kol_media_read on public.shop_kol_post_media
  for select using (
    lifecycle = 'published'
    or public.is_admin()
    or exists (select 1 from public.shop_kol_posts p where p.id = post_id and p.author_profile_id = auth.uid())
  );

drop policy if exists kol_upload_sessions_owner on public.kol_upload_sessions;
create policy kol_upload_sessions_owner on public.kol_upload_sessions
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists kol_moderation_admin on public.kol_moderation_events;
create policy kol_moderation_admin on public.kol_moderation_events
  for select using (public.is_admin());

drop policy if exists kol_reward_events_read on public.kol_reward_events;
create policy kol_reward_events_read on public.kol_reward_events
  for select using (user_id = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';
