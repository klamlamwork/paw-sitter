-- 100% tip retention. Sitters keep the full tip; release 24 hours after payment.
-- Paste into the Supabase SQL editor.

alter table public.escrow_entries drop constraint if exists escrow_entries_kind_check;
alter table public.escrow_entries
  add constraint escrow_entries_kind_check check (kind in ('booking', 'shop_order', 'tip'));

create table if not exists public.booking_tips (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  sitter_id uuid not null references public.sitters (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 100),
  currency text not null default 'CAD',
  status text not null default 'pending',
  stripe_session_id text,
  stripe_payment_intent text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_tips_booking_idx on public.booking_tips (booking_id, created_at desc);
create index if not exists booking_tips_stripe_session_idx on public.booking_tips (stripe_session_id);

alter table public.booking_tips enable row level security;

drop policy if exists booking_tips_select on public.booking_tips;
create policy booking_tips_select on public.booking_tips
  for select using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.sitters s
      where s.id = sitter_id and s.profile_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
