# Escrow + Stripe Connect setup

## 1) Run the migration
- In Supabase SQL Editor, run `sql/57-escrow-connect.sql`.

## 2) Stripe Connect (platform)
- In your Stripe Dashboard, enable **Connect** and create an **Express** platform.
- Copy your platform keys to `.env.local`:
  - `STRIPE_SECRET_KEY` (platform secret key)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET` (for both booking and shop webhooks)
- Add webhook endpoints in Stripe:
  - `https://your-domain.com/api/booking/stripe-webhook` → events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`
  - `https://your-domain.com/api/shop/stripe-webhook` → events: `checkout.session.completed`

## 3) Environment
- Ensure `.env.local` includes:
  - `NEXT_PUBLIC_SITE_URL` (e.g. `http://localhost:3000` or your production domain)
  - `SUPABASE_SERVICE_ROLE_KEY` (used by admin client and cron)
  - Optional: `CRON_SECRET` (if you want a dedicated secret for the cron)

## 4) Onboard sitters and shops
- Sitters: visit `/sitter/payouts` and click **Connect bank with Stripe**.
- Shops: visit `/account/shop/payouts` and click **Connect bank with Stripe**.
- Payouts will be enabled only after Stripe shows `payouts_enabled = true`.

## 5) Settlement cron (48h services / 14d products, weekly payouts)
- The job lives at `/api/admin/settle-escrow`.
- Call it regularly (e.g. every 15 minutes) with `?payout=1` to also send transfers.
- Example curl:
  ```bash
  curl -X POST https://your-domain.com/api/admin/settle-escrow?payout=1 \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

## 6) Marking completion (triggers release timers)
- Services: when a sitter marks a booking complete, call `POST /api/booking/complete` with `{ "booking_id": "..." }`.
- Products: when a shop marks an order delivered, call `POST /api/shop/order-delivered` with `{ "order_id": "..." }`.
- The escrow job will set `release_at` to `now + 48h` (services) or `now + 14d` (products), then move entries to `releasable` and pay out on the next cron run with `?payout=1`.

## 7) Commission rates
- Default is 10% for both services and shops.
- Adjust in `platform_settings` table: `service_commission_pct` and `shop_commission_pct`.

## 8) Testing in sandbox
- Use Stripe test cards and test Connect onboarding.
- Create a test booking and a test shop order, pay them, then manually call `/api/admin/settle-escrow?payout=1` to see transfers created in your Stripe test dashboard.
