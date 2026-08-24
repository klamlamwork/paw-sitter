-- Notification preferences + send log. Run in Supabase SQL editor.

alter table public.profiles
  add column if not exists email_transactional boolean not null default true,
  add column if not exists email_marketing boolean not null default false,
  add column if not exists sms_opt_in boolean not null default false,
  add column if not exists notify_booking_updates boolean not null default true,
  add column if not exists notify_order_updates boolean not null default true,
  add column if not exists notify_reminders boolean not null default true;

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  channel text not null default 'email',
  recipient text not null,
  intended_recipient text,
  template text,
  status text not null default 'sent',
  detail text,
  created_at timestamptz not null default now(),
  unique (event_key, channel, recipient)
);

alter table public.notification_log enable row level security;

notify pgrst, 'reload schema';
