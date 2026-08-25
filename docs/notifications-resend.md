# Notifications (Resend sandbox → live)

Transactional mail is sent from the app with Resend, not Supabase Auth SMTP.
Auth still sends signup verification and password-reset links.

## Sandbox (now)

```
RESEND_API_KEY=re_...
EMAIL_FROM=Joyful Paws <beth.t@example.com>
EMAIL_SANDBOX_TO=you@your-resend-login.com
NOTIFICATION_WEBHOOK_SECRET=long-random-string
CRON_SECRET=long-random-string
NEXT_PUBLIC_SITE_URL=https://paw-sitter.vercel.app
```

`EMAIL_SANDBOX_TO` reroutes every transactional email to that inbox. The real recipient is prefixed on the subject as `[to: user@x.com]`.

## Live (later, no code change)

```
EMAIL_FROM=Joyful Paws <hello@mail.yourdomain.com>
EMAIL_SANDBOX_TO=
```

## Supabase Database Webhooks

Create two webhooks, same URL and Bearer secret:

1. Table `bookings` — INSERT, UPDATE
2. Table `shop_orders` — INSERT, UPDATE

URL: `https://YOUR_DOMAIN/api/webhooks/notifications`
Header: `Authorization` = `Bearer FAKESECRET_k1l2m3n4o5p6q7r8s9t0`

## Cron reminders

`vercel.json` calls `/api/cron/notifications` hourly. Vercel sends an Authorization header automatically on Pro; on Hobby you can hit:

`/api/cron/notifications?secret=CRON_SECRET`

Sends:
- customer reminder ~24 hours before an accepted booking slot
- sitter daily overview of accepted sittings in the next 48 hours (once per sitter per day)

## Preferences

Users can toggle channels at `/account/notifications`.
Run `sql/84-notification-prefs.sql` if you have not already.
