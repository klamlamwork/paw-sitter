alter table public.shop_orders
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent text;

create index if not exists shop_orders_stripe_session_idx
  on public.shop_orders (stripe_session_id);

notify pgrst, 'reload schema';
