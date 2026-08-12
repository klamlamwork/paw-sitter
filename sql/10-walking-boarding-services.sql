do $$ begin
  alter type public.service_kind add value if not exists 'walking';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.service_kind add value if not exists 'boarding';
exception when duplicate_object then null;
end $$;

alter table public.sitter_services
  add column if not exists accepts_dogs boolean not null default true;

alter table public.sitter_services
  add column if not exists accepts_cats boolean not null default true;

alter table public.bookings
  add column if not exists pets_dogs boolean not null default false;

alter table public.bookings
  add column if not exists pets_cats boolean not null default false;

notify pgrst, 'reload schema';
