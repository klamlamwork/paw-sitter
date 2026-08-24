-- Sitter applications + verified phone. Run in Supabase SQL editor.

alter table public.sitters
  add column if not exists application_status text not null default 'approved',
  add column if not exists applied_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists phone_country_code text,
  add column if not exists phone_e164 text,
  add column if not exists phone_verified_at timestamptz;

update public.sitters
set application_status = 'approved'
where is_active = true
  and (application_status is null or application_status = '');

alter table public.sitters enable row level security;
alter table public.sitter_services enable row level security;
alter table public.sitter_weekly_availability enable row level security;

drop policy if exists sitters_own_select on public.sitters;
create policy sitters_own_select on public.sitters
  for select
  using (profile_id = auth.uid());

drop policy if exists sitters_own_update on public.sitters;
create policy sitters_own_update on public.sitters
  for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists sitter_services_own_all on public.sitter_services;
create policy sitter_services_own_all on public.sitter_services
  for all
  using (
    exists (select 1 from public.sitters s where s.id = sitter_id and s.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from public.sitters s where s.id = sitter_id and s.profile_id = auth.uid())
  );

drop policy if exists sitter_weekly_own_all on public.sitter_weekly_availability;
create policy sitter_weekly_own_all on public.sitter_weekly_availability
  for all
  using (
    exists (select 1 from public.sitters s where s.id = sitter_id and s.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from public.sitters s where s.id = sitter_id and s.profile_id = auth.uid())
  );

notify pgrst, 'reload schema';
