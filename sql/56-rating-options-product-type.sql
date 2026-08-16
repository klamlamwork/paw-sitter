-- Rating options belong to product_type (same 10 types as product create/edit)

alter table public.shop_rating_options
  add column if not exists product_type text;

update public.shop_rating_options
set product_type = 'other'
where product_type is null or product_type = '';

alter table public.shop_rating_options
  alter column product_type set default 'other';

alter table public.shop_rating_options
  alter column product_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shop_rating_options_product_type_check'
  ) then
    alter table public.shop_rating_options
      add constraint shop_rating_options_product_type_check
      check (product_type in (
        'food', 'treats', 'supplements', 'litter',
        'bowls', 'beds', 'toys', 'grooming', 'apparel', 'other'
      ));
  end if;
end $$;

alter table public.shop_rating_options
  alter column category_id drop not null;

create index if not exists shop_rating_options_type_idx
  on public.shop_rating_options (product_type, sort_order);

notify pgrst, 'reload schema';
