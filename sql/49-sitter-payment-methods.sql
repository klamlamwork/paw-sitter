alter table public.sitter_payments
  add column if not exists card_enabled boolean not null default false,
  add column if not exists etransfer_enabled boolean not null default true,
  add column if not exists pay_later_enabled boolean not null default true;

update public.sitter_payments
set card_enabled = stripe_enabled
where card_enabled is distinct from stripe_enabled;

notify pgrst, 'reload schema';
