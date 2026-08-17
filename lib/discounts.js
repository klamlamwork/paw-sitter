import { createAdminClient } from "@/lib/supabase/admin";
import { dollarsToCents } from "@/lib/money";

export function normalizeCode(raw) {
  return String(raw || "").trim().toUpperCase();
}

export function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

function itemTotal(item) {
  return Math.max(0, (Number(item.price_cents) || 0) * (Number(item.qty) || 1));
}

export function eligibleItems(code, items = []) {
  return (items || []).filter((item) => {
    if (!code?.scope || code.scope === "site") return true;
    if (code.scope === "booking" || (code.scope === "vendor" && code.vendor_sitter_id)) {
      return item.sitter_id && item.sitter_id === code.vendor_sitter_id;
    }
    if (code.scope === "shop_order" || (code.scope === "vendor" && code.vendor_shop_id)) {
      return item.shop_id && item.shop_id === code.vendor_shop_id;
    }
    if (code.scope === "category") {
      const wanted = new Set((code.category_ids || []).map(String));
      return (item.category_ids || []).some((id) => wanted.has(String(id)));
    }
    return false;
  });
}

export function computeDiscountCents(code, subtotalCents, shippingCents = 0) {
  const subtotal = Math.max(0, Number(subtotalCents) || 0);
  const shipping = Math.max(0, Number(shippingCents) || 0);
  const minSpend = Number(code.min_spend_cents) || 0;
  if (minSpend > 0 && subtotal < minSpend) return 0;
  if (code.type === "percent") {
    const pct = Number(code.percent_off) || 0;
    return Math.min(subtotal, Math.round((subtotal * pct) / 100));
  }
  if (code.type === "fixed" || code.type === "threshold") {
    return Math.min(subtotal, Number(code.fixed_off_cents) || 0);
  }
  if (code.type === "shipping" || code.applies_to_shipping) {
    return Math.min(shipping, Number(code.fixed_off_cents) || shipping);
  }
  return 0;
}

export function quoteDiscount(code, items = [], { shippingCents = 0 } = {}) {
  const eligible = eligibleItems(code, items);
  const eligibleSubtotal = eligible.reduce((sum, item) => sum + itemTotal(item), 0);
  const discountCents = computeDiscountCents(code, eligibleSubtotal, shippingCents);
  const byVendor = new Map();
  for (const item of eligible) {
    const vendorType = item.sitter_id ? "sitter" : "shop";
    const vendorId = item.sitter_id || item.shop_id;
    if (!vendorId) continue;
    const key = `${vendorType}:${vendorId}`;
    const current = byVendor.get(key) || { vendorType, vendorId, gross: 0, discount: 0 };
    current.gross += itemTotal(item);
    byVendor.set(key, current);
  }
  const rows = [...byVendor.values()];
  const totalGross = rows.reduce((sum, row) => sum + row.gross, 0) || 1;
  let allocated = 0;
  rows.forEach((row, index) => {
    const share = index === rows.length - 1 ? discountCents - allocated : Math.round((discountCents * row.gross) / totalGross);
    row.discount = Math.max(0, share);
    allocated += row.discount;
  });
  return {
    discountCents,
    eligibleSubtotal,
    shippingCents,
    breakdown: rows,
    fundedByPlatform: !!(code.kind === "admin" && code.funded_by_platform),
  };
}

export function applyEscrowDiscount({ grossCents, commissionPct, discountCents = 0, fundedBy = "vendor" }) {
  const gross = Math.max(0, Number(grossCents) || 0);
  const commission = Math.round((gross * (Number(commissionPct) || 0)) / 100);
  const discount = Math.max(0, Number(discountCents) || 0);
  const platformAbsorbedCents = fundedBy === "platform" ? Math.min(discount, commission) : 0;
  const vendorFundedCents = discount - platformAbsorbedCents;
  return {
    gross_cents: gross,
    commission_pct: Number(commissionPct) || 0,
    commission_cents: commission,
    discount_cents: discount,
    discount_funded_by: fundedBy || null,
    platform_absorbed_cents: platformAbsorbedCents,
    net_cents: Math.max(0, gross - commission - vendorFundedCents),
  };
}

export async function loadActiveCode(raw) {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, reason: "Enter a promo code." };
  const admin = createAdminClient();
  const now = new Date();
  const { data, error } = await admin.from("discount_codes").select("*").eq("code", code).maybeSingle();
  if (error) return { ok: false, reason: error.message };
  if (!data || !data.active) return { ok: false, reason: "This promo code is not active." };
  if (data.starts_at && new Date(data.starts_at) > now) return { ok: false, reason: "This promo has not started yet." };
  if (data.expires_at && new Date(data.expires_at) < now) return { ok: false, reason: "This promo code has expired." };
  return { ok: true, code: data };
}

export async function assertRedemptionAllowed(code, userId, { bookingId } = {}) {
  const admin = createAdminClient();
  if (code.max_redemptions) {
    const { count } = await admin.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code_id", code.id);
    if ((count || 0) >= code.max_redemptions) return { ok: false, reason: "This promo has reached its redemption limit." };
  }
  if (code.max_per_user && userId) {
    const { count } = await admin.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code_id", code.id).eq("user_id", userId);
    if ((count || 0) >= code.max_per_user) return { ok: false, reason: "You have already used this promo code." };
  }
  if (code.first_booking_only && userId) {
    const { count } = await admin.from("bookings").select("id", { count: "exact", head: true }).eq("customer_id", userId).neq("status", "cancelled").neq("status", "canceled");
    if ((count || 0) > (bookingId ? 1 : 0)) return { ok: false, reason: "This code is for a first booking only." };
  }
  return { ok: true };
}

export async function attachProductCategories(items) {
  const productIds = [...new Set((items || []).map((item) => item.product_id).filter(Boolean))];
  if (!productIds.length) return items || [];
  const admin = createAdminClient();
  const { data } = await admin.from("shop_product_categories").select("product_id, category_id").in("product_id", productIds);
  const map = new Map();
  for (const row of data || []) {
    if (!map.has(row.product_id)) map.set(row.product_id, []);
    map.get(row.product_id).push(row.category_id);
  }
  return (items || []).map((item) => ({ ...item, category_ids: map.get(item.product_id) || item.category_ids || [] }));
}

export async function quoteShopCode(raw, userId, cartItems) {
  const loaded = await loadActiveCode(raw);
  if (!loaded.ok) return loaded;
  const allowed = await assertRedemptionAllowed(loaded.code, userId);
  if (!allowed.ok) return allowed;
  if (!cartItems?.length) return { ok: false, reason: "Your cart is empty." };
  const items = await attachProductCategories(cartItems);
  if (!eligibleItems(loaded.code, items).length) {
    return { ok: false, reason: "This code does not apply to the items in your cart." };
  }
  const quote = quoteDiscount(loaded.code, items);
  if (!quote.discountCents) {
    if ((Number(loaded.code.percent_off) || 0) <= 0 && (Number(loaded.code.fixed_off_cents) || 0) <= 0) {
      return { ok: false, reason: "This promo has no discount value set. Edit it in Admin → Discounts." };
    }
    return { ok: false, reason: "This cart does not meet the promo rules." };
  }
  return { ok: true, code: loaded.code, quote };
}

export async function quoteBookingCode(raw, user, booking) {
  const loaded = await loadActiveCode(raw);
  if (!loaded.ok) return loaded;
  const allowed = await assertRedemptionAllowed(loaded.code, user.id, { bookingId: booking.id });
  if (!allowed.ok) return allowed;
  const items = [{ sitter_id: booking.sitter_id, price_cents: dollarsToCents(booking.estimated_total), qty: 1 }];
  if (!eligibleItems(loaded.code, items).length) {
    return { ok: false, reason: "This code does not apply to this booking." };
  }
  const quote = quoteDiscount(loaded.code, items);
  if (!quote.discountCents) return { ok: false, reason: "This booking does not meet the promo rules." };
  return { ok: true, code: loaded.code, quote };
}

export async function recordRedemption({ code, userId, bookingId, orderId, discountCents, fundedByPlatform, breakdown = [] }) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("discount_redemptions")
    .select("id")
    .eq("code_id", code.id)
    .eq(bookingId ? "booking_id" : "order_id", bookingId || orderId)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin
    .from("discount_redemptions")
    .insert({
      code_id: code.id,
      user_id: userId,
      booking_id: bookingId || null,
      order_id: orderId || null,
      discount_cents: discountCents,
      funded_by_platform: !!fundedByPlatform,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (breakdown.length) {
    await admin.from("discount_ledger").insert(
      breakdown.map((row) => ({
        redemption_id: data.id,
        code_id: code.id,
        vendor_type: row.vendorType,
        vendor_id: row.vendorId,
        gross_cents: row.gross,
        discount_cents: row.discount,
        platform_absorbed_cents: fundedByPlatform ? row.discount : 0,
        net_to_vendor_cents: Math.max(0, row.gross - (fundedByPlatform ? 0 : row.discount)),
      }))
    );
  }
  return data;
}

export function publicCode(code, quote) {
  return {
    id: code.id,
    code: code.code,
    label: code.label || code.code,
    kind: code.kind,
    type: code.type,
    scope: code.scope,
    funded_by_platform: !!(code.kind === "admin" && code.funded_by_platform),
    discount_cents: quote?.discountCents || 0,
    eligible_subtotal_cents: quote?.eligibleSubtotal || 0,
    breakdown: quote?.breakdown || [],
  };
}
