create table if not exists public.pet_profile_history (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  module text not null,
  changed_fields text[] not null default '{}',
  before_data jsonb,
  after_data jsonb,
  review text,
  points int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pet_profile_history_pet_idx on public.pet_profile_history (pet_id, created_at desc);

alter table public.pet_profile_history enable row level security;
drop policy if exists pet_profile_history_read on public.pet_profile_history;
create policy pet_profile_history_read on public.pet_profile_history
  for select using (
    public.is_admin()
    or exists (select 1 from public.pets p where p.id = pet_id and p.profile_id = auth.uid())
  );

notify pgrst, 'reload schema';
