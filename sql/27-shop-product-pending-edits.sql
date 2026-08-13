-- Pending shop edits: public keeps live approved content until admin approves

alter table public.shop_products
  add column if not exists has_pending_edit boolean not null default false;

alter table public.shop_products
  add column if not exists pending_snapshot jsonb;

alter table public.shop_products
  add column if not exists pending_submitted_at timestamptz;

alter table public.shop_products
  add column if not exists pending_submitted_by uuid references public.profiles (id) on delete set null;

comment on column public.shop_products.pending_snapshot is
  'Shop-submitted product fields/media/longevity awaiting admin approval';

create index if not exists shop_products_pending_edit_idx
  on public.shop_products (has_pending_edit)
  where has_pending_edit = true;

notify pgrst, 'reload schema';
