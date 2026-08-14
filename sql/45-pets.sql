-- Pets profile for customers

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  species text not null default 'dog',
  breed text,
  weight_lbs numeric(5,2),
  age_years integer not null default 0,
  age_months integer not null default 0,
  sex text,
  is_spayed_neutered boolean,
  medications text[],
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pets_profile_idx on public.pets (profile_id);

create table if not exists public.booking_pets (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  unique (booking_id, pet_id)
);

create index if not exists booking_pets_booking_idx on public.booking_pets (booking_id);
create index if not exists booking_pets_pet_idx on public.booking_pets (pet_id);

notify pgrst, 'reload schema';
