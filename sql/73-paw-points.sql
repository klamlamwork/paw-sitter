-- Paw Points: immutable ledger + rates + balance function

create table if not exists public.paw_point_settings (
  id int primary key default 1 check (id = 1),
  cents_per_point numeric not null default 0.2,
  min_redeem_points int not null default 100,
  max_redeem_pct numeric not null default 40,
  expire_inactive_months int not null default 12,
  default_product_points_per_dollar numeric not null default 10,
  booking_points_per_dollar numeric not null default 5,
  updated_at timestamptz not null default now()
);

insert into public.paw_point_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.paw_point_earn_rates (
  source_key text primary key,
  label text not null,
  points_per_dollar numeric not null default 0,
  flat_points int not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.paw_point_earn_rates (source_key, label, points_per_dollar) values
  ('food', 'Food', 10),
  ('treats', 'Treats', 10),
  ('supplements', 'Supplements / aids', 10),
  ('litter', 'Litter', 10),
  ('bowls', 'Bowls', 10),
  ('beds', 'Beds', 10),
  ('toys', 'Toys', 10),
  ('grooming', 'Grooming', 10),
  ('apparel', 'Apparel', 10),
  ('other', 'Other products', 10),
  ('sitter_booking', 'Sitter booking', 5),
  ('kol_review', 'KOL product review', 0),
  ('kol_guide', 'KOL care guide', 0)
  on conflict (source_key) do nothing;

create table if not exists public.paw_point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta int not null,
  status text not null check (status in ('pending', 'available', 'reserved', 'expired', 'clawed')),
  reason text not null check (reason in (
    'earn_order', 'earn_booking', 'earn_kol', 'redeem', 'admin_grant', 'admin_adjust',
    'expire', 'clawback', 'cash_offset', 'activate'
  )),
  source_key text,
  order_id uuid,
  booking_id uuid,
  lot_id uuid,
  admin_id uuid,
  remark text default '',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists paw_point_ledger_user_idx on public.paw_point_ledger (user_id, status, created_at);
create index if not exists paw_point_ledger_order_idx on public.paw_point_ledger (order_id);
create index if not exists paw_point_ledger_booking_idx on public.paw_point_ledger (booking_id);
create index if not exists paw_point_ledger_lot_idx on public.paw_point_ledger (lot_id);

alter table public.profiles add column if not exists last_active_at timestamptz default now();

alter table public.shop_orders add column if not exists paw_points_redeemed int not null default 0;
alter table public.shop_orders add column if not exists paw_points_cents int not null default 0;

alter table public.bookings add column if not exists paw_points_redeemed int not null default 0;
alter table public.bookings add column if not exists paw_points_cents int not null default 0;

alter table public.paw_point_settings enable row level security;
alter table public.paw_point_earn_rates enable row level security;
alter table public.paw_point_ledger enable row level security;

grant select on public.paw_point_settings to authenticated, anon;
grant select on public.paw_point_earn_rates to authenticated, anon;
grant select on public.paw_point_ledger to authenticated;

drop policy if exists paw_point_settings_read on public.paw_point_settings;
create policy paw_point_settings_read on public.paw_point_settings for select using (true);

drop policy if exists paw_point_rates_read on public.paw_point_earn_rates;
create policy paw_point_rates_read on public.paw_point_earn_rates for select using (true);

drop policy if exists paw_point_ledger_read on public.paw_point_ledger;
create policy paw_point_ledger_read on public.paw_point_ledger
  for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.get_user_paw_balance(p_user_id uuid)
returns table (available int, pending int, reserved int)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(delta) filter (where status = 'available'), 0)::int as available,
    coalesce(sum(delta) filter (where status = 'pending' and delta > 0), 0)::int as pending,
    coalesce(-sum(delta) filter (where status = 'reserved' and delta < 0), 0)::int as reserved
  from public.paw_point_ledger
  where user_id = p_user_id;
$$;

revoke all on function public.get_user_paw_balance(uuid) from public;
grant execute on function public.get_user_paw_balance(uuid) to authenticated;

create or replace function public.touch_profile_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set last_active_at = now() where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists paw_point_ledger_touch on public.paw_point_ledger;
create trigger paw_point_ledger_touch
  after insert on public.paw_point_ledger
  for each row execute function public.touch_profile_activity();

notify pgrst, 'reload schema';
