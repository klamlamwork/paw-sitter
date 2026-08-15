alter table public.sitter_weekly_availability enable row level security;

drop policy if exists "Sitters manage own weekly availability" on public.sitter_weekly_availability;
create policy "Sitters manage own weekly availability"
  on public.sitter_weekly_availability
  for all
  using (
    exists (
      select 1 from public.sitters s
      where s.id = sitter_weekly_availability.sitter_id
        and s.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sitters s
      where s.id = sitter_weekly_availability.sitter_id
        and s.profile_id = auth.uid()
    )
  );

drop policy if exists "Admins manage weekly availability" on public.sitter_weekly_availability;
create policy "Admins manage weekly availability"
  on public.sitter_weekly_availability
  for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

notify pgrst, 'reload schema';
