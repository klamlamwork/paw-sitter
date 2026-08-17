import { createAdminClient } from "@/lib/supabase/admin";

export function serviceHasStarted(booking, now = new Date()) {
  const slots = booking?.booking_slots || [];
  if (!slots.length) return false;
  const t = new Date(now).getTime();
  return slots.some((s) => s?.starts_at && new Date(s.starts_at).getTime() <= t);
}

export function canTipBooking(booking) {
  if (!booking) return { ok: false, reason: "Booking not found." };
  if (["cancelled", "canceled"].includes(booking.status)) return { ok: false, reason: "This booking was cancelled." };
  const paid = booking.payment_received || ["paid", "authorized", "partially_refunded"].includes(booking.payment_status);
  if (!paid) return { ok: false, reason: "Tips are available after the booking is paid." };
  if (!serviceHasStarted(booking)) return { ok: false, reason: "Tips open after the service start time." };
  return { ok: true };
}

export async function recordTipEscrow(tip) {
  const admin = createAdminClient();
  const paidAt = tip.paid_at || new Date().toISOString();
  const releaseAt = new Date(new Date(paidAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await admin.from("escrow_entries").select("id").eq("kind", "tip").eq("ref_id", tip.id).maybeSingle();
  if (existing) return existing;
  const { data: sitter } = await admin.from("sitters").select("profile_id").eq("id", tip.sitter_id).maybeSingle();
  const { data, error } = await admin.from("escrow_entries").insert({
    kind: "tip",
    ref_id: tip.id,
    provider_type: "sitter",
    provider_id: tip.sitter_id,
    owner_profile_id: sitter?.profile_id || null,
    currency: tip.currency || "CAD",
    gross_cents: tip.amount_cents,
    commission_pct: 0,
    commission_cents: 0,
    net_cents: tip.amount_cents,
    status: "escrow_pending",
    stripe_payment_intent: tip.stripe_payment_intent || null,
    release_at: releaseAt,
    notes: "100% tip retention. Releases 24 hours after the customer paid.",
  }).select("id").maybeSingle();
  if (error) throw error;
  return data;
}

export async function syncPaidTipsToEscrow() {
  const admin = createAdminClient();
  const created = [];
  const notes = [];
  const { data: tips, error } = await admin.from("booking_tips").select("*").eq("status", "paid");
  if (error) return { created, notes: [error.message] };
  for (const tip of tips || []) {
    try {
      const { data: existing } = await admin.from("escrow_entries").select("id").eq("kind", "tip").eq("ref_id", tip.id).maybeSingle();
      if (existing) continue;
      await recordTipEscrow(tip);
      created.push(`tip:${tip.id}`);
    } catch (err) {
      notes.push(`tip ${tip.id}: ${err.message}`);
    }
  }
  return { created, notes };
}
