-- Booking inbox: one conversation per booking, sitters can also be clients

create table if not exists public.booking_conversations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  sitter_id uuid not null references public.sitters (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  last_sender_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.booking_conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  photo_url text,
  created_at timestamptz not null default now()
);

create index if not exists booking_conversations_last_idx on public.booking_conversations (last_message_at desc);
create index if not exists booking_conversations_customer_idx on public.booking_conversations (customer_id);
create index if not exists booking_conversations_sitter_idx on public.booking_conversations (sitter_id);
create index if not exists booking_messages_convo_idx on public.booking_messages (conversation_id, created_at);

alter table public.booking_conversations enable row level security;
alter table public.booking_messages enable row level security;

create or replace function public.is_conversation_participant(convo_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.booking_conversations c
    left join public.sitters s on s.id = c.sitter_id
    where c.id = convo_id
      and (c.customer_id = auth.uid() or s.profile_id = auth.uid() or public.is_admin())
  );
$$;

drop policy if exists booking_conversations_select on public.booking_conversations;
create policy booking_conversations_select on public.booking_conversations
  for select using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.sitters s where s.id = sitter_id and s.profile_id = auth.uid())
  );

drop policy if exists booking_conversations_insert on public.booking_conversations;
create policy booking_conversations_insert on public.booking_conversations
  for insert with check (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.sitters s where s.id = sitter_id and s.profile_id = auth.uid())
  );

drop policy if exists booking_conversations_update on public.booking_conversations;
create policy booking_conversations_update on public.booking_conversations
  for update using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.sitters s where s.id = sitter_id and s.profile_id = auth.uid())
  );

drop policy if exists booking_messages_select on public.booking_messages;
create policy booking_messages_select on public.booking_messages
  for select using (public.is_conversation_participant(conversation_id));

drop policy if exists booking_messages_insert on public.booking_messages;
create policy booking_messages_insert on public.booking_messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

insert into storage.buckets (id, name, public)
values ('inbox-photos', 'inbox-photos', true)
on conflict (id) do nothing;

drop policy if exists inbox_photos_public_read on storage.objects;
create policy inbox_photos_public_read on storage.objects
  for select using (bucket_id = 'inbox-photos');

drop policy if exists inbox_photos_auth_write on storage.objects;
create policy inbox_photos_auth_write on storage.objects
  for insert to authenticated with check (bucket_id = 'inbox-photos');

notify pgrst, 'reload schema';
