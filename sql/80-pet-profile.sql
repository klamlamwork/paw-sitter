-- Extended pet profile modules + catalog + profile point ledger reason

alter table public.pets add column if not exists birthday_year int;
alter table public.pets add column if not exists birthday_month int;
alter table public.pets add column if not exists birthday_day int;
alter table public.pets add column if not exists weight_unit text default 'lbs';
alter table public.pets add column if not exists microchipped boolean;
alter table public.pets add column if not exists microchip_number text;
alter table public.pets add column if not exists vet_clinic text;

create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  brand text not null,
  name text not null,
  species text,
  is_longevity_partner boolean not null default false,
  active boolean not null default true
);

create table if not exists public.pet_diet (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  food_brand text,
  food_product_id uuid references public.product_catalog(id),
  food_product_name text,
  feeding_style text,
  feeder_type text,
  water_source text,
  portion_notes text,
  treats text[] default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_hygiene (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  litter_product_id uuid references public.product_catalog(id),
  litter_name text,
  litter_cleaning text,
  floor_cleaner text,
  home_fragrance text[] default '{}',
  bathing_product text,
  nail_routine text,
  brushing_routine text,
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_medical (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  allergies text[] default '{}',
  conditions text[] default '{}',
  insurance_company text,
  policy_number text,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_social (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  friendly_with text[] default '{}',
  play_toys text[] default '{}',
  custom_toy text,
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_health_episodes (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  event_type text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.pet_profile_rewards (
  pet_id uuid not null references public.pets(id) on delete cascade,
  module text not null,
  first_bonus_paid boolean not null default false,
  last_rewarded_at timestamptz,
  primary key (pet_id, module)
);

create index if not exists product_catalog_cat_idx on public.product_catalog (category, active);
create index if not exists pet_health_episodes_pet_idx on public.pet_health_episodes (pet_id, created_at desc);

alter table public.product_catalog enable row level security;
alter table public.pet_diet enable row level security;
alter table public.pet_hygiene enable row level security;
alter table public.pet_medical enable row level security;
alter table public.pet_social enable row level security;
alter table public.pet_health_episodes enable row level security;
alter table public.pet_profile_rewards enable row level security;

drop policy if exists product_catalog_read on public.product_catalog;
create policy product_catalog_read on public.product_catalog for select using (true);

insert into public.product_catalog (category, brand, name, species, is_longevity_partner) values
  ('food', 'Royal Canin', 'Royal Canin Adult', 'dog', false),
  ('food', 'Hill''s', 'Hill''s Science Diet Adult', 'dog', true),
  ('food', 'Orijen', 'Orijen Original', 'dog', true),
  ('food', 'Acana', 'Acana Prairie Poultry', 'dog', false),
  ('food', 'Purina Pro Plan', 'Purina Pro Plan Adult', 'dog', false),
  ('food', 'Open Farm', 'Open Farm Homestead Turkey', 'dog', true),
  ('food', 'Royal Canin', 'Royal Canin Indoor Adult', 'cat', false),
  ('food', 'Hill''s', 'Hill''s Science Diet Indoor', 'cat', true),
  ('food', 'Wellness', 'Wellness Complete Health', 'cat', false),
  ('food', 'Fancy Feast', 'Fancy Feast Classic', 'cat', false),
  ('treat', 'Greenies', 'Greenies Dental Treats', null, false),
  ('treat', 'Blue Buffalo', 'Blue Buffalo Bits', null, false),
  ('treat', 'Wellness', 'Wellness Soft Puppy Bites', 'dog', false),
  ('treat', 'Temptations', 'Temptations Classic', 'cat', false),
  ('litter', 'World''s Best', 'World''s Best Clumping', 'cat', true),
  ('litter', 'Arm & Hammer', 'Arm & Hammer Clump & Seal', 'cat', false),
  ('litter', 'Fresh Step', 'Fresh Step Multi-Cat', 'cat', false),
  ('litter', 'Tidy Cats', 'Tidy Cats 24/7', 'cat', false),
  ('toy', 'KONG', 'KONG Classic', 'dog', false),
  ('toy', 'Chuckit', 'Chuckit Ultra Ball', 'dog', false),
  ('toy', 'Yeowww', 'Yeowww Catnip Banana', 'cat', false),
  ('toy', 'Catit', 'Catit Play Circuit', 'cat', false)
on conflict do nothing;

alter table public.paw_point_ledger drop constraint if exists paw_point_ledger_reason_check;
alter table public.paw_point_ledger add constraint paw_point_ledger_reason_check
  check (reason in (
    'earn_order', 'earn_booking', 'earn_kol', 'earn_referral', 'earn_profile', 'redeem',
    'admin_grant', 'admin_adjust', 'expire', 'clawback', 'cash_offset', 'activate'
  ));

notify pgrst, 'reload schema';
