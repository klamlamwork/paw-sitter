import { createAdminClient } from "@/lib/supabase/admin";

export async function releaseReservedPoints({ userId, orderId, bookingId }) {
  const admin = createAdminClient();
  let q = admin
    .from("paw_point_ledger")
    .select("id, user_id, delta, order_id, booking_id")
    .eq("reason", "redeem")
    .eq("status", "reserved")
    .lt("delta", 0);
  if (orderId) q = q.eq("order_id", orderId);
  else if (bookingId) q = q.eq("booking_id", bookingId);
  else if (userId) q = q.eq("user_id", userId);
  else return { released: 0 };

  const { data: rows, error } = await q;
  if (error) throw error;

  let released = 0;
  for (const row of rows || []) {
    const pts = Math.abs(Number(row.delta) || 0);
    if (!pts) continue;

    // Remove the temporary negative FIFO movement. The original source lot is
    // immediately spendable again because getBalance sees no redemption row.
    const { error: delErr } = await admin.from("paw_point_ledger").delete().eq("id", row.id);
    if (delErr) throw delErr;

    // Valid, non-financial audit row. The schema permits available/admin_adjust;
    // delta 0 does not alter balance or FIFO lot availability.
    const { error: auditErr } = await admin.from("paw_point_ledger").insert({
      user_id: row.user_id,
      delta: 0,
      status: "available",
      reason: "admin_adjust",
      order_id: row.order_id || orderId || null,
      booking_id: row.booking_id || bookingId || null,
      remark: `Released ${pts} reserved Paw Points after incomplete Stripe payment`,
    });
    if (auditErr) throw auditErr;
    released += pts;
  }
  return { released };
}

export async function clearUserShopCart(admin, { cartId, userId }) {
  if (cartId) {
    const { error } = await admin.from("shop_cart_items").delete().eq("cart_id", cartId);
    if (error) throw error;
    return;
  }
  if (!userId) return;
  const { data: carts, error } = await admin.from("shop_carts").select("id").eq("user_id", userId);
  if (error) throw error;
  for (const cart of carts || []) {
    const { error: delErr } = await admin.from("shop_cart_items").delete().eq("cart_id", cart.id);
    if (delErr) throw delErr;
  }
}
