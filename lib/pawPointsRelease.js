import { createAdminClient } from "@/lib/supabase/admin";

export async function releaseReservedPoints({ userId, orderId, bookingId }) {
  const admin = createAdminClient();
  let q = admin
    .from("paw_point_ledger")
    .select("id, user_id, delta")
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
    const { error: upErr } = await admin.from("paw_point_ledger").update({ status: "released" }).eq("id", row.id);
    if (upErr) throw upErr;
    const { error: insErr } = await admin.from("paw_point_ledger").insert({
      user_id: row.user_id,
      delta: pts,
      status: "available",
      reason: "unreserve",
      order_id: orderId || null,
      booking_id: bookingId || null,
      remark: "Released after incomplete Stripe payment",
    });
    if (insErr) throw insErr;
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
