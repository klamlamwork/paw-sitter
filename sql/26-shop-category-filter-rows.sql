-- Category filter lines on /shop/ products section
-- filter_row 1 = first filter line, 2 = second line
-- sort_order already exists for sequence within a line

alter table public.shop_categories
  add column if not exists filter_row int not null default 1;

-- Clamp to 1 or 2
update public.shop_categories
set filter_row = 1
where filter_row is null or filter_row < 1 or filter_row > 2;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shop_categories_filter_row_check'
  ) then
    alter table public.shop_categories
      add constraint shop_categories_filter_row_check
      check (filter_row in (1, 2));
  end if;
end $$;

comment on column public.shop_categories.filter_row is
  '1 = first filter row on /shop/, 2 = second filter row';

notify pgrst, 'reload schema';
