-- Mid-service refund policy columns. Paste into the Supabase SQL editor.

alter table public.bookings
  add column if not exists cancel_actor text,
  add column if not exists cancel_reason text,
  add column if not exists refund_cents integer,
  add column if not exists retained_cents integer,
  add column if not exists addon_cents integer default 0,
  add column if not exists sitter_waived boolean not null default false,
  add column if not exists refund_breakdown jsonb,
  add column if not exists refunded_at timestamptz;

create table if not exists public.booking_refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  actor text not null check (actor in ('owner', 'sitter')),
  waived boolean not null default false,
  refund_cents integer not null default 0,
  retained_cents integer not null default 0,
  stripe_refund_id text,
  breakdown jsonb,
  created_at timestamptz not null default now()
);

alter table public.booking_refunds enable row level security;

drop policy if exists booking_refunds_select on public.booking_refunds;
create policy booking_refunds_select on public.booking_refunds
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.customer_id = auth.uid() or exists (
          select 1 from public.sitters s
          where s.id = b.sitter_id and s.profile_id = auth.uid()
        ))
    )
  );

notify pgrst, 'reload schema';
