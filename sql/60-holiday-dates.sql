-- Platform holidays. Bookings on these dates use each sitter's holiday rate.
-- Paste into the Supabase SQL editor.

create table if not exists public.holiday_dates (
  holiday_date date primary key,
  name text not null default 'Holiday',
  created_at timestamptz not null default now()
);

alter table public.holiday_dates add column if not exists name text;
update public.holiday_dates set name = 'Holiday' where name is null;

alter table public.holiday_dates enable row level security;

drop policy if exists holiday_dates_select on public.holiday_dates;
create policy holiday_dates_select on public.holiday_dates for select using (true);

drop policy if exists holiday_dates_admin on public.holiday_dates;
create policy holiday_dates_admin on public.holiday_dates
  for all using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
