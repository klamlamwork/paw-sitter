-- Referral codes and first-booking-or-purchase Paw Point rewards

create table if not exists public.referral_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null unique references public.profiles (id) on delete cascade,
  code text not null,
  status text not null default 'pending',
  qualified_source text,
  qualified_booking_id uuid,
  qualified_order_id uuid,
  signup_ip text,
  available_at timestamptz,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  check (status in ('pending', 'holding', 'queued', 'rewarded', 'void', 'rejected')),
  check (referrer_id <> referred_id)
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id, status);
create index if not exists referrals_status_idx on public.referrals (status, available_at);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

drop policy if exists referral_codes_read on public.referral_codes;
create policy referral_codes_read on public.referral_codes
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals
  for select using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());

alter table public.paw_point_ledger drop constraint if exists paw_point_ledger_reason_check;
alter table public.paw_point_ledger add constraint paw_point_ledger_reason_check
  check (reason in (
    'earn_order', 'earn_booking', 'earn_kol', 'earn_referral', 'redeem',
    'admin_grant', 'admin_adjust', 'expire', 'clawback', 'cash_offset', 'activate'
  ));

notify pgrst, 'reload schema';
