import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { activatePendingFor, grantPendingEarn } from "@/lib/pawPoints";

export const REFERRAL_POINTS = 5000;
export const REFERRAL_MONTHLY_CAP = 25000;
export const SHOP_HOLD_DAYS = 7;

function normCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function maskName(fullName) {
  const parts = String(fullName || "Friend").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Friend";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].slice(0, 1).toUpperCase()}.`;
}

export function referralLink(code, origin) {
  const base = (origin || process.env.NEXT_PUBLIC_SITE_URL || "https://paw-sitter.vercel.app").replace(/\/$/, "");
  return `${base}/login?ref=${encodeURIComponent(code)}`;
}

export async function ensureReferralCode(userId) {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("referral_codes").select("code").eq("user_id", userId).maybeSingle();
  if (existing?.code) return existing.code;
  let code = `PAW${String(userId).replace(/-/g, "").slice(0, 6).toUpperCase()}`;
  for (let i = 0; i < 6; i++) {
    const { data: clash } = await admin.from("referral_codes").select("user_id").eq("code", code).maybeSingle();
    if (!clash) break;
    code = `PAW${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
  const { error } = await admin.from("referral_codes").insert({ user_id: userId, code });
  if (error && !/duplicate/i.test(error.message)) throw error;
  const { data: row } = await admin.from("referral_codes").select("code").eq("user_id", userId).maybeSingle();
  return row?.code || code;
}

function sameAddress(a, b) {
  const line = (p) => `${p?.address_line1 || ""}|${p?.city || ""}|${p?.postal_code || ""}`.toLowerCase().replace(/\s+/g, "");
  const left = line(a);
  const right = line(b);
  if (!left.replace(/\|/g, "") || !right.replace(/\|/g, "")) return false;
  return left === right;
}

export async function linkReferral({ referredId, code, ip = "", profile = null }) {
  const clean = normCode(code);
  if (!clean || !referredId) return null;
  const admin = createAdminClient();
  const { data: existing } = await admin.from("referrals").select("id").eq("referred_id", referredId).maybeSingle();
  if (existing) return existing;
  const { data: found } = await admin.from("referral_codes").select("user_id, code").eq("code", clean).maybeSingle();
  if (!found?.user_id || found.user_id === referredId) return null;
  const { data: referrer } = await admin.from("profiles").select("id, address_line1, city, postal_code").eq("id", found.user_id).maybeSingle();
  const referred = profile || (await admin.from("profiles").select("id, address_line1, city, postal_code").eq("id", referredId).maybeSingle()).data;
  const rejected = sameAddress(referrer, referred);
  const { data, error } = await admin.from("referrals").insert({
    referrer_id: found.user_id,
    referred_id: referredId,
    code: found.code,
    status: rejected ? "rejected" : "pending",
    signup_ip: ip || null,
  }).select("id, status").maybeSingle();
  if (error) {
    if (/duplicate/i.test(error.message)) return null;
    throw error;
  }
  return data;
}

export async function attachReferralFromCookies(profile) {
  if (!profile?.id) return null;
  const jar = await cookies();
  const code = jar.get("paw_ref")?.value;
  if (!code) return null;
  const linked = await linkReferral({ referredId: profile.id, code, profile });
  try {
    jar.set("paw_ref", "", { path: "/", maxAge: 0 });
  } catch {
    /* cookie delete may fail in some server contexts */
  }
  return linked;
}

export async function monthReferralEarned(referrerId, when = new Date()) {
  const admin = createAdminClient();
  const start = new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), 1)).toISOString();
  const end = new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth() + 1, 1)).toISOString();
  const { data } = await admin
    .from("paw_point_ledger")
    .select("delta")
    .eq("user_id", referrerId)
    .eq("reason", "earn_referral")
    .gt("delta", 0)
    .in("status", ["pending", "available"])
    .gte("created_at", start)
    .lt("created_at", end);
  return (data || []).reduce((s, r) => s + Number(r.delta || 0), 0);
}

async function grantPair({ referrerId, referredId, orderId, bookingId, pending }) {
  const remark = bookingId ? "Referral — First booking completed" : "Referral — First purchase completed";
  const status = pending ? "pending" : "available";
  const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  if (pending) {
    await grantPendingEarn({
      userId: referrerId,
      points: REFERRAL_POINTS,
      reason: "earn_referral",
      sourceKey: "referral",
      orderId,
      bookingId,
      remark,
    });
    await grantPendingEarn({
      userId: referredId,
      points: REFERRAL_POINTS,
      reason: "earn_referral",
      sourceKey: "referral",
      orderId,
      bookingId,
      remark,
    });
    return;
  }
  const admin = createAdminClient();
  for (const userId of [referrerId, referredId]) {
    await admin.from("paw_point_ledger").insert({
      user_id: userId,
      delta: REFERRAL_POINTS,
      status,
      reason: "earn_referral",
      source_key: "referral",
      order_id: orderId || null,
      booking_id: bookingId || null,
      remark,
      expires_at: expires,
    });
  }
}

async function payOrQueue(row, payload) {
  const earned = await monthReferralEarned(row.referrer_id);
  const admin = createAdminClient();
  if (earned + REFERRAL_POINTS > REFERRAL_MONTHLY_CAP) {
    await admin.from("referrals").update({
      status: "queued",
      qualified_source: payload.source,
      qualified_booking_id: payload.bookingId || null,
      qualified_order_id: payload.orderId || null,
      available_at: payload.availableAt || null,
    }).eq("id", row.id).in("status", ["pending", "queued", "holding"]);
    return { queued: true };
  }
  const pending = payload.source === "shop_order";
  await grantPair({
    referrerId: row.referrer_id,
    referredId: row.referred_id,
    orderId: payload.orderId,
    bookingId: payload.bookingId,
    pending,
  });
  if (pending) {
    await admin.from("referrals").update({
      status: "holding",
      qualified_source: "shop_order",
      qualified_order_id: payload.orderId,
      available_at: payload.availableAt,
    }).eq("id", row.id);
  } else {
    await admin.from("referrals").update({
      status: "rewarded",
      qualified_source: "booking",
      qualified_booking_id: payload.bookingId,
      rewarded_at: new Date().toISOString(),
      available_at: new Date().toISOString(),
    }).eq("id", row.id);
  }
  return { paid: true, pending };
}

export async function onReferralBookingCompleted(bookingId) {
  const admin = createAdminClient();
  const { data: booking } = await admin.from("bookings").select("id, customer_id, status").eq("id", bookingId).maybeSingle();
  if (!booking?.customer_id || booking.status === "canceled" || booking.status === "cancelled") return;
  await flushReferralRewards();
  const { data: row } = await admin.from("referrals").select("*").eq("referred_id", booking.customer_id).maybeSingle();
  if (!row || !['pending', 'queued'].includes(row.status)) return;
  const { count } = await admin.from("bookings").select("id", { count: "exact", head: true }).eq("customer_id", booking.customer_id).eq("status", "completed").neq("id", bookingId);
  if ((count || 0) > 0) return;
  return payOrQueue(row, { source: "booking", bookingId });
}

export async function onReferralShopDelivered(orderId) {
  const admin = createAdminClient();
  const { data: order } = await admin.from("shop_orders").select("id, user_id, payment_status, status, delivered_at, paid_at, created_at").eq("id", orderId).maybeSingle();
  if (!order?.user_id) return;
  if (/refund/i.test(order.payment_status || "") || /refund|cancel/i.test(order.status || "")) return;
  await flushReferralRewards();
  const { data: row } = await admin.from("referrals").select("*").eq("referred_id", order.user_id).maybeSingle();
  if (!row || !['pending', 'queued'].includes(row.status)) return;
  const { count: doneBookings } = await admin.from("bookings").select("id", { count: "exact", head: true }).eq("customer_id", order.user_id).eq("status", "completed");
  if ((doneBookings || 0) > 0) return;
  const { count: priorOrders } = await admin.from("shop_orders").select("id", { count: "exact", head: true }).eq("user_id", order.user_id).neq("id", orderId).in("payment_status", ["paid", "authorized"]);
  if ((priorOrders || 0) > 0) return;
  const start = new Date(order.delivered_at || order.paid_at || order.created_at || Date.now());
  const availableAt = new Date(start.getTime() + SHOP_HOLD_DAYS * 24 * 3600 * 1000).toISOString();
  return payOrQueue(row, { source: "shop_order", orderId, availableAt });
}

export async function voidReferralForOrder(orderId) {
  const admin = createAdminClient();
  const { data: row } = await admin.from("referrals").select("id, status").eq("qualified_order_id", orderId).maybeSingle();
  if (!row || row.status === "rewarded") return;
  await admin.from("referrals").update({ status: "void" }).eq("id", row.id).in("status", ["holding", "queued", "pending"]);
}

export async function flushReferralRewards() {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: holding } = await admin.from("referrals").select("*").eq("status", "holding").lte("available_at", now);
  for (const row of holding || []) {
    const { data: order } = await admin.from("shop_orders").select("id, payment_status, status").eq("id", row.qualified_order_id).maybeSingle();
    if (!order || /refund/i.test(order.payment_status || "") || /refund|cancel/i.test(order.status || "")) {
      await admin.from("referrals").update({ status: "void" }).eq("id", row.id);
      continue;
    }
    await activatePendingFor({ orderId: row.qualified_order_id });
    await admin.from("referrals").update({ status: "rewarded", rewarded_at: now }).eq("id", row.id);
  }
  const { data: queued } = await admin.from("referrals").select("*").eq("status", "queued").order("created_at", { ascending: true });
  for (const row of queued || []) {
    const earned = await monthReferralEarned(row.referrer_id);
    if (earned + REFERRAL_POINTS > REFERRAL_MONTHLY_CAP) continue;
    if (row.qualified_source === "shop_order" && row.qualified_order_id) {
      await payOrQueue({ ...row, status: "pending" }, {
        source: "shop_order",
        orderId: row.qualified_order_id,
        availableAt: row.available_at || new Date(Date.now() + SHOP_HOLD_DAYS * 24 * 3600 * 1000).toISOString(),
      });
    } else if (row.qualified_booking_id) {
      await payOrQueue({ ...row, status: "pending" }, {
        source: "booking",
        bookingId: row.qualified_booking_id,
      });
    }
  }
}

export async function listReferralActivity(referrerId) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("referrals")
    .select("id, status, qualified_source, created_at, rewarded_at, referred_id, profiles:referred_id(full_name)")
    .eq("referrer_id", referrerId)
    .order("created_at", { ascending: false });
  return (data || []).map((row) => {
    const name = maskName(row.profiles?.full_name);
    let line = `${name} — Signed up — waiting for first completed booking or purchase`;
    if (row.status === "holding") line = `${name} — First purchase completed (available after 7 days)`;
    if (row.status === "queued") line = `${name} — Queued until next month (monthly cap)`;
    if (row.status === "rewarded" && row.qualified_source === "booking") line = `${name} — First booking completed (+${REFERRAL_POINTS})`;
    if (row.status === "rewarded" && row.qualified_source === "shop_order") line = `${name} — First purchase completed (+${REFERRAL_POINTS})`;
    if (row.status === "void" || row.status === "rejected") line = `${name} — Referral not rewarded`;
    return { ...row, line };
  });
}
