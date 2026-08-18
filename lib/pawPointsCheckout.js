import { clampRedeem, getBalance, reserveRedeem } from "@/lib/pawPoints";

export async function applyCheckoutPoints({ userId, orderIds, bookingId, merchandiseCents, requestedPoints }) {
  const want = Math.floor(Number(requestedPoints) || 0);
  if (want <= 0) return { points: 0, cents: 0 };
  const balance = await getBalance(userId);
  const check = clampRedeem(want, balance.available, merchandiseCents);
  if (!check.ok) throw new Error(check.reason);
  return reserveRedeem({
    userId,
    points: check.points,
    orderId: orderIds?.[0] || null,
    bookingId: bookingId || null,
  });
}
