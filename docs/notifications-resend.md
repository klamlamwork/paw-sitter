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

## Cron reminders (Hobby-safe)

Vercel Hobby only allows crons that run **once per day**. Hourly expressions fail the deploy.

`vercel.json` runs `/api/cron/notifications` daily at 14:15 UTC. That job:
- emails customers whose accepted booking starts in the next 12–36 hours
- emails sitters a 48-hour overview (once per sitter per calendar day)

Manual test: `/api/cron/notifications?secret=CRON_SECRET`

## Preferences

Users can toggle channels at `/account/notifications`.
Run `sql/84-notification-prefs.sql` if you have not already.
