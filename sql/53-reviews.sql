-- Paid + completed bookings can request customer/sitter reviews; admin publishes them

create table if not exists public.review_invites (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  customer_token text not null unique,
  sitter_token text not null unique,
  service_ended_at timestamptz,
  customer_emailed_at timestamptz,
  sitter_emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sitter_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  invite_id uuid references public.review_invites (id) on delete set null,
  sitter_id uuid not null references public.sitters (id) on delete cascade,
  customer_id uuid references public.profiles (id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  body text not null,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz
);

create table if not exists public.pet_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  invite_id uuid references public.review_invites (id) on delete set null,
  pet_id uuid not null references public.pets (id) on delete cascade,
  sitter_id uuid not null references public.sitters (id) on delete cascade,
  body text not null,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  unique (booking_id, pet_id)
);

create index if not exists sitter_reviews_sitter_status_idx on public.sitter_reviews (sitter_id, status);
create index if not exists pet_reviews_pet_status_idx on public.pet_reviews (pet_id, status);
create index if not exists review_invites_tokens_idx on public.review_invites (customer_token, sitter_token);

alter table public.review_invites enable row level security;
alter table public.sitter_reviews enable row level security;
alter table public.pet_reviews enable row level security;

drop policy if exists sitter_reviews_public_select on public.sitter_reviews;
create policy sitter_reviews_public_select on public.sitter_reviews
  for select using (status = 'published');

drop policy if exists pet_reviews_public_select on public.pet_reviews;
create policy pet_reviews_public_select on public.pet_reviews
  for select using (status = 'published');

drop policy if exists pets_public_reviewed_select on public.pets;
create policy pets_public_reviewed_select on public.pets
  for select using (
    exists (
      select 1 from public.pet_reviews r
      where r.pet_id = pets.id and r.status = 'published'
    )
  );

drop policy if exists review_invites_admin on public.review_invites;
create policy review_invites_admin on public.review_invites
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists sitter_reviews_admin on public.sitter_reviews;
create policy sitter_reviews_admin on public.sitter_reviews
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists pet_reviews_admin on public.pet_reviews;
create policy pet_reviews_admin on public.pet_reviews
  for all using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
