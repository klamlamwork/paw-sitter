import { createAdminClient } from "@/lib/supabase/admin";
import { dollarsToCents } from "@/lib/money";

export async function validateCode(code, user, cart) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error } = await admin
    .from("discount_codes")
    .select("*")
    .eq("code", code)
    .eq("active", true)
    .lte("starts_at", now)
    .or(`expires_at.is.null,expires_at.gte.${now}`)
    .maybeSingle();
  if (error || !row) return { ok: false, reason: "Invalid or inactive code." };

  // Redemption limits
  const { count } = await admin
    .from("discount_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("code_id", row.id);
  if (row.max_redemptions && count >= row.max_redemptions)
    return { ok: false, reason: "This code has reached its redemption limit." };

  const { count: userCount } = await admin
    .from("discount_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("code_id", row.id)
    .eq("user_id", user.id);
  if (row.max_per_user && userCount >= row.max_per_user)
    return { ok: false, reason: `You can use this code at most ${row.max_per_user} time(s).` };

  if (row.first_booking_only) {
    const { count: past } = await admin
      .from("discount_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("code_id", row.id)
      .eq("user_id", user.id)
      .not("booking_id", "is", null);
    if (past > 0) return { ok: false, reason: "This code is for first bookings only." };
  }

  // Scope & vendor checks
  if (row.scope === "vendor" || row.scope === "booking") {
    const hasEligible = cart.some((i) => i.sitter_id === row.vendor_sitter_id);
    if (!hasEligible) return { ok: false, reason: "This code doesn’t apply to items in your cart." };
  }
  if (row.scope === "vendor" || row.scope === "shop_order") {
    const hasEligible = cart.some((i) => i.shop_id === row.vendor_shop_id);
    if (!hasEligible) return { ok: false, reason: "This code doesn’t apply to items in your cart." };
  }

  // Minimum spend
  if (row.type === "threshold" || row.applies_to_shipping) {
    const subtotal = cart.reduce((s, i) => s + i.price_cents * (i.qty || 1), 0);
    if (subtotal < (row.min_spend_cents || 0))
      return { ok: false, reason: `Minimum spend is $${(row.min_spend_cents / 100).toFixed(2)}.` };
  }

  return { ok: true, code: row };
}

export function applyDiscount(code, cart) {
  // Return { discountCents, breakdownByVendor }
  let discountCents = 0;
  const breakdown = new Map(); // vendorKey -> { gross, discount }

  if (code.scope === "site" || code.scope === "category") {
    // Apply across entire cart
    const subtotal = cart.reduce((s, i) => s + i.price_cents * (i.qty || 1), 0);
    discountCents = computeDiscount(code, subtotal);
    // Attribute proportionally
    for (const item of cart) {
      const key = item.sitter_id ? `sitter:${item.sitter_id}` : `shop:${item.shop_id}`;
      const gross = item.price_cents * (item.qty || 1);
      const share = gross / Math.max(1, subtotal);
      const d = Math.round(discountCents * share);
      breakdown.set(key, { gross, discount: (breakdown.get(key)?.discount || 0) + d });
    }
  } else if (code.scope === "vendor" || code.scope === "booking") {
    const sitterItems = cart.filter((i) => i.sitter_id === code.vendor_sitter_id);
    const subtotal = sitterItems.reduce((s, i) => s + i.price_cents * (i.qty || 1), 0);
    discountCents = computeDiscount(code, subtotal);
    const key = `sitter:${code.vendor_sitter_id}`;
    breakdown.set(key, { gross: subtotal, discount: discountCents });
  } else if (code.scope === "vendor" || code.scope === "shop_order") {
    const shopItems = cart.filter((i) => i.shop_id === code.vendor_shop_id);
    const subtotal = shopItems.reduce((s, i) => s + i.price_cents * (i.qty || 1), 0);
    discountCents = computeDiscount(code, subtotal);
    const key = `shop:${code.vendor_shop_id}`;
    breakdown.set(key, { gross: subtotal, discount: discountCents });
  }

  return { discountCents, breakdown: Array.from(breakdown.entries()) };
}

function computeDiscount(code, subtotal) {
  if (code.type === "percent") {
    return Math.round((subtotal * (code.percent_off || 0)) / 100);
  } else if (code.type === "fixed") {
    return Math.min(subtotal, code.fixed_off_cents || 0);
  } else if (code.type === "threshold") {
    if (subtotal >= (code.min_spend_cents || 0)) {
      return Math.min(subtotal, code.fixed_off_cents || 0);
    }
  } else if (code.type === "shipping" && code.applies_to_shipping) {
    return code.min_spend_cents || 0; // treat as fixed off shipping
  }
  return 0;
}
