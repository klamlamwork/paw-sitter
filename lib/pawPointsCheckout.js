import { clampRedeem, getBalance } from "@/lib/pawPoints";

// Quotes the Paw Points discount for Stripe. It intentionally does NOT create
// a ledger reservation. Points are deducted only in the confirmed-payment hook.
export async function applyCheckoutPoints({ userId, orderIds, bookingId, merchandiseCents, requestedPoints, maxDiscountCents }) {
  const want = Math.floor(Number(requestedPoints) || 0);
  if (want <= 0) return { points: 0, cents: 0, capPoints: 0 };

  const balance = await getBalance(userId);
  const check = clampRedeem(want, balance.available, merchandiseCents, { maxDiscountCents });
  if (!check.ok) {
    return { points: 0, cents: 0, capPoints: check.capPoints || 0, reason: check.reason };
  }

  return {
    points: check.points,
    cents: check.cents,
    capPoints: check.capPoints,
    quoted_only: true,
  };
}
