-- Ensure sitter payment settings exist and admins can update them

create table if not exists public.sitter_payments (
  id uuid primary key default gen_random_uuid(),
  stripe_enabled boolean not null default false,
  platform_fee_pct numeric(4,2) not null default 10.00,
  updated_at timestamptz not null default now()
);

alter table public.sitter_payments
  add column if not exists card_enabled boolean not null default false,
  add column if not exists etransfer_enabled boolean not null default true,
  add column if not exists pay_later_enabled boolean not null default true;

update public.sitter_payments
set card_enabled = stripe_enabled
where card_enabled is distinct from stripe_enabled;

insert into public.sitter_payments (stripe_enabled, card_enabled, etransfer_enabled, pay_later_enabled, platform_fee_pct)
select false, false, true, true, 10.00
where not exists (select 1 from public.sitter_payments);

alter table public.sitter_payments enable row level security;

drop policy if exists sitter_payments_public_select on public.sitter_payments;
create policy sitter_payments_public_select on public.sitter_payments
  for select using (true);

drop policy if exists sitter_payments_admin_write on public.sitter_payments;
create policy sitter_payments_admin_write on public.sitter_payments
  for all using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
