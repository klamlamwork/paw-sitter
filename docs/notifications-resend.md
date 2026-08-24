# Notifications (Resend sandbox → live)

Transactional mail is sent from the app with Resend, not Supabase Auth SMTP.
Auth still sends signup verification and password-reset links.

## Sandbox (now)

1. Create a [Resend](https://resend.com) account and API key.
2. In sandbox, Resend only delivers to **your own Resend login email**.
3. Vercel env:

```
RESEND_API_KEY=re_...
EMAIL_FROM=Joyful Paws <beth.t@example.com>
EMAIL_SANDBOX_TO=you@your-resend-login.com
NOTIFICATION_WEBHOOK_SECRET=long-random-string
NEXT_PUBLIC_SITE_URL=https://paw-sitter.vercel.app
```

`EMAIL_SANDBOX_TO` reroutes every transactional email to that inbox. The real recipient is added to the subject as `[to: user@x.com]` so templates do not change later.

## Live (later, no code change)

1. Verify a domain in Resend (for example `mail.yourdomain.com`).
2. Change only env vars, then redeploy:

```
EMAIL_FROM=Joyful Paws <hello@mail.yourdomain.com>
EMAIL_SANDBOX_TO=
```

Leave `EMAIL_SANDBOX_TO` empty so mail goes to the real customer/sitter.

## Supabase Database Webhook

Database → Webhooks → Create:

- Table: `bookings`
- Events: INSERT, UPDATE
- URL: `https://YOUR_DOMAIN/api/webhooks/notifications`
- HTTP header: `Authorization` = `Bearer FAKESECRET_k1l2m3n4o5p6q7r8s9t0`

## Forgot password

Uses Supabase Auth `resetPasswordForEmail`. In Auth URL config allow `https://YOUR_DOMAIN/auth/callback` and `http://localhost:3000/auth/callback`.
