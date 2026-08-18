import { clampRedeem, getBalance, reserveRedeem } from "@/lib/pawPoints";

export async function applyCheckoutPoints({ userId, orderIds, merchandiseCents, requestedPoints }) {
  const want = Math.floor(Number(requestedPoints) || 0);
  if (want <= 0 || !orderIds?.length) return { points: 0, cents: 0 };
  const balance = await getBalance(userId);
  const check = clampRedeem(want, balance.available, merchandiseCents);
  if (!check.ok) throw new Error(check.reason);
  const reserved = await reserveRedeem({ userId, points: check.points, orderId: orderIds[0] });
  return { points: reserved.points, cents: reserved.cents };
}
