-- Managed escrow via Stripe Connect (separate charges + transfers).
-- Do not hold customer funds in a custom platform bank account.

create table if not exists public.platform_settings (
  id integer primary key default 1 check (id = 1),
  service_commission_pct numeric(5,2) not null default 10.00,
  shop_commission_pct numeric(5,2) not null default 10.00,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.stripe_connect_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('sitter', 'shop')),
  sitter_id uuid references public.sitters (id) on delete cascade,
  shop_id uuid references public.shop_shops (id) on delete cascade,
  stripe_account_id text not null unique,
  details_submitted boolean not null default false,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stripe_connect_sitter_uidx
  on public.stripe_connect_accounts (sitter_id) where sitter_id is not null;
create unique index if not exists stripe_connect_shop_uidx
  on public.stripe_connect_accounts (shop_id) where shop_id is not null;

create table if not exists public.escrow_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('booking', 'shop_order')),
  ref_id uuid not null,
  provider_type text not null check (provider_type in ('sitter', 'shop')),
  provider_id uuid not null,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  currency text not null default 'CAD',
  gross_cents integer not null,
  commission_pct numeric(5,2) not null,
  commission_cents integer not null,
  net_cents integer not null,
  status text not null default 'escrow_pending',
  stripe_payment_intent text,
  stripe_transfer_id text,
  release_at timestamptz,
  released_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, ref_id)
);

create index if not exists escrow_status_release_idx on public.escrow_entries (status, release_at);
create index if not exists escrow_provider_idx on public.escrow_entries (provider_type, provider_id, status);

alter table public.platform_settings enable row level security;
alter table public.stripe_connect_accounts enable row level security;
alter table public.escrow_entries enable row level security;

drop policy if exists platform_settings_select on public.platform_settings;
create policy platform_settings_select on public.platform_settings for select using (true);
drop policy if exists platform_settings_admin on public.platform_settings;
create policy platform_settings_admin on public.platform_settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists stripe_connect_select on public.stripe_connect_accounts;
create policy stripe_connect_select on public.stripe_connect_accounts
  for select using (owner_profile_id = auth.uid() or public.is_admin());

drop policy if exists escrow_select on public.escrow_entries;
create policy escrow_select on public.escrow_entries
  for select using (owner_profile_id = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';
