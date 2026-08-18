import { clampRedeem, getBalance, reserveRedeem } from "@/lib/pawPoints";

export async function applyCheckoutPoints({ userId, orderIds, bookingId, merchandiseCents, requestedPoints }) {
  const want = Math.floor(Number(requestedPoints) || 0);
  if (want <= 0) return { points: 0, cents: 0, capPoints: 0 };
  const balance = await getBalance(userId);
  const check = clampRedeem(want, balance.available, merchandiseCents);
  if (!check.ok) return { points: 0, cents: 0, capPoints: check.capPoints || 0, reason: check.reason };
  const reserved = await reserveRedeem({
    userId,
    points: check.points,
    orderId: orderIds?.[0] || null,
    bookingId: bookingId || null,
  });
  return {
    points: reserved.points || check.points,
    cents: reserved.cents || check.cents,
    capPoints: check.capPoints,
  };
}
