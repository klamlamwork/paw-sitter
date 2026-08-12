-- Public read access for active sitters and their enabled services.
-- Safe for listing pages: do not expose private fields in UI (e.g. invite_email).

alter table public.sitters enable row level security;
alter table public.sitter_services enable row level security;

drop policy if exists sitters_public_select on public.sitters;
create policy sitters_public_select on public.sitters
  for select
  using (is_active = true);

drop policy if exists sitter_services_public_select on public.sitter_services;
create policy sitter_services_public_select on public.sitter_services
  for select
  using (
    enabled = true
    and exists (
      select 1 from public.sitters s
      where s.id = sitter_id and s.is_active = true
    )
  );
