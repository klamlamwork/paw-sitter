create table if not exists public.sitter_day_availability (
  id uuid primary key default gen_random_uuid(),
  sitter_id uuid not null references public.sitters (id) on delete cascade,
  day date not null,
  service_type public.service_kind not null,
  is_available boolean not null default true,
  start_time time default '09:00',
  end_time time default '17:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sitter_id, day, service_type)
);
create index if not exists sitter_day_avail_sitter_day_idx on public.sitter_day_availability (sitter_id, day);
alter table public.sitter_day_availability enable row level security;
drop policy if exists day_avail_select on public.sitter_day_availability;
drop policy if exists day_avail_admin on public.sitter_day_availability;
drop policy if exists day_avail_sitter on public.sitter_day_availability;
create policy day_avail_select on public.sitter_day_availability for select using (true);
create policy day_avail_admin on public.sitter_day_availability for all using (public.is_admin()) with check (public.is_admin());
create policy day_avail_sitter on public.sitter_day_availability for all
  using (exists (select 1 from public.sitters s where s.id = sitter_id and s.profile_id = auth.uid()))
  with check (exists (select 1 from public.sitters s where s.id = sitter_id and s.profile_id = auth.uid()));
