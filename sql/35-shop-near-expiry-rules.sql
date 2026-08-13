-- V7: near-expiry hide + optional auto-discount (shop-level policy)
-- Run after sql/33 (and 34 if FEFO is in use)

alter table public.shop_shops
  add column if not exists expiry_hide_days int not null default 0;

alter table public.shop_shops
  add column if not exists expiry_discount_days int not null default 7;

alter table public.shop_shops
  add column if not exists expiry_discount_pct int not null default 0;

comment on column public.shop_shops.expiry_hide_days is
  'Hide lots from storefront when days-to-expiry <= this (0 = hide only expired)';
comment on column public.shop_shops.expiry_discount_days is
  'Apply expiry_discount_pct when days-to-expiry <= this';
comment on column public.shop_shops.expiry_discount_pct is
  'Percent off sell price for near-expiry FEFO lot (0 = off)';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shop_shops_expiry_hide_days_check'
  ) then
    alter table public.shop_shops
      add constraint shop_shops_expiry_hide_days_check
      check (expiry_hide_days >= 0 and expiry_hide_days <= 90);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'shop_shops_expiry_discount_days_check'
  ) then
    alter table public.shop_shops
      add constraint shop_shops_expiry_discount_days_check
      check (expiry_discount_days >= 0 and expiry_discount_days <= 90);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'shop_shops_expiry_discount_pct_check'
  ) then
    alter table public.shop_shops
      add constraint shop_shops_expiry_discount_pct_check
      check (expiry_discount_pct >= 0 and expiry_discount_pct <= 90);
  end if;
end $$;

notify pgrst, 'reload schema';
