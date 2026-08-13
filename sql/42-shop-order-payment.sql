-- Payment tracking before card checkout (e-transfer / pickup / later)

alter table public.shop_orders
  add column if not exists payment_method text,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at timestamptz,
  add column if not exists seller_note text;

notify pgrst, 'reload schema';
