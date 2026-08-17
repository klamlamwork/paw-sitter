import { createAdminClient } from "@/lib/supabase/admin";
import { applyEscrowDiscount } from "@/lib/discounts";

function toCents(amount) {
  const n = Number(amount) || 0;
  return Number.isInteger(n) && n >= 0 ? n : Math.round(n * 100);
}

function split(gross, pct) {
  const commission = Math.round((gross * (Number(pct) || 0)) / 100);
  return { commission_cents: commission, net_cents: Math.max(0, gross - commission) };
}

async function settings(admin) {
  const { data, error } = await admin.from("platform_settings").select("*").eq("id", 1).maybeSingle();
  return {
    service_commission_pct: Number(data?.service_commission_pct ?? 10),
    shop_commission_pct: Number(data?.shop_commission_pct ?? 10),
    settings_error: error?.message || null,
  };
}

export async function syncEscrowFromPaidActivity() {
  const admin = createAdminClient();
  const cfg = await settings(admin);
  const created = [];
  const notes = [];
  if (cfg.settings_error) notes.push(`platform_settings: ${cfg.settings_error}`);

  const { data: bookings, error: bookingErr } = await admin
    .from("bookings")
    .select("id, sitter_id, status, payment_status, payment_received, estimated_total, discount_cents, discount_funded_by, stripe_payment_intent")
    .or("payment_status.in.(paid,authorized),payment_received.eq.true");
  if (bookingErr) notes.push(`bookings query: ${bookingErr.message}`);

  let bookingCandidates = (bookings || []).length;
  let bookingSkippedNoAmount = 0;
  for (const b of bookings || []) {
    const gross = toCents(b.estimated_total);
    if (!gross || !b.sitter_id) {
      bookingSkippedNoAmount += 1;
      continue;
    }
    const discountCents = Math.max(0, Number(b.discount_cents) || 0);
    const fundedBy = b.discount_funded_by === "platform" ? "platform" : (discountCents ? "vendor" : "vendor");
    const parts = applyEscrowDiscount({ grossCents: gross, commissionPct: cfg.service_commission_pct, discountCents, fundedBy });
    const { data: existing, error: existingErr } = await admin
      .from("escrow_entries")
      .select("id, release_at")
      .eq("kind", "booking")
      .eq("ref_id", b.id)
      .maybeSingle();
    if (existingErr) {
      notes.push(`escrow lookup booking ${b.id}: ${existingErr.message}`);
      continue;
    }
    if (!existing) {
      const { data: sitter } = await admin.from("sitters").select("profile_id").eq("id", b.sitter_id).maybeSingle();
      const { error: insertErr } = await admin.from("escrow_entries").insert({
        kind: "booking",
        ref_id: b.id,
        provider_type: "sitter",
        provider_id: b.sitter_id,
        owner_profile_id: sitter?.profile_id || null,
        gross_cents: parts.gross_cents,
        commission_pct: parts.commission_pct,
        commission_cents: parts.commission_cents,
        discount_cents: parts.discount_cents,
        discount_funded_by: parts.discount_funded_by,
        platform_absorbed_cents: parts.platform_absorbed_cents,
        net_cents: parts.net_cents,
        status: "escrow_pending",
        stripe_payment_intent: b.stripe_payment_intent || null,
        notes: "Held after buyer paid. Releases 48h after service completed.",
      });
      if (insertErr) notes.push(`insert booking ${b.id}: ${insertErr.message}`);
      else created.push(`booking:${b.id}`);
    }
    if (["completed", "complete"].includes(b.status)) {
      const release = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { error: relErr } = await admin
        .from("escrow_entries")
        .update({ release_at: existing?.release_at || release, updated_at: new Date().toISOString() })
        .eq("kind", "booking")
        .eq("ref_id", b.id)
        .is("release_at", null)
        .eq("status", "escrow_pending");
      if (relErr) notes.push(`release_at booking ${b.id}: ${relErr.message}`);
    }
  }

  const { data: orders, error: orderErr } = await admin
    .from("shop_orders")
    .select("id, seller_shop_id, status, payment_status, discount_cents, discount_funded_by, stripe_payment_intent")
    .eq("payment_status", "paid");
  if (orderErr) notes.push(`shop_orders query: ${orderErr.message}`);

  let orderCandidates = (orders || []).length;
  let orderSkippedNoAmount = 0;
  for (const o of orders || []) {
    const { data: items } = await admin.from("shop_order_items").select("qty, price_cents, currency").eq("order_id", o.id);
    const gross = (items || []).reduce((sum, i) => sum + (i.price_cents || 0) * (i.qty || 0), 0);
    if (!gross || !o.seller_shop_id) {
      orderSkippedNoAmount += 1;
      continue;
    }
    const discountCents = Math.max(0, Number(o.discount_cents) || 0);
    const fundedBy = o.discount_funded_by === "platform" ? "platform" : (discountCents ? "vendor" : "vendor");
    const parts = applyEscrowDiscount({ grossCents: gross, commissionPct: cfg.shop_commission_pct, discountCents, fundedBy });
    const { data: existing, error: existingErr } = await admin
      .from("escrow_entries")
      .select("id, release_at")
      .eq("kind", "shop_order")
      .eq("ref_id", o.id)
      .maybeSingle();
    if (existingErr) {
      notes.push(`escrow lookup order ${o.id}: ${existingErr.message}`);
      continue;
    }
    if (!existing) {
      const { data: shop } = await admin.from("shop_shops").select("owner_profile_id").eq("id", o.seller_shop_id).maybeSingle();
      const { error: insertErr } = await admin.from("escrow_entries").insert({
        kind: "shop_order",
        ref_id: o.id,
        provider_type: "shop",
        provider_id: o.seller_shop_id,
        owner_profile_id: shop?.owner_profile_id || null,
        currency: items?.[0]?.currency || "CAD",
        gross_cents: parts.gross_cents,
        commission_pct: parts.commission_pct,
        commission_cents: parts.commission_cents,
        discount_cents: parts.discount_cents,
        discount_funded_by: parts.discount_funded_by,
        platform_absorbed_cents: parts.platform_absorbed_cents,
        net_cents: parts.net_cents,
        status: "escrow_pending",
        stripe_payment_intent: o.stripe_payment_intent || null,
        notes: "Held after buyer paid. Releases 14 days after delivery.",
      });
      if (insertErr) notes.push(`insert order ${o.id}: ${insertErr.message}`);
      else created.push(`order:${o.id}`);
    }
    if (o.status === "delivered") {
      const release = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { error: relErr } = await admin
        .from("escrow_entries")
        .update({ release_at: existing?.release_at || release, updated_at: new Date().toISOString() })
        .eq("kind", "shop_order")
        .eq("ref_id", o.id)
        .is("release_at", null)
        .eq("status", "escrow_pending");
      if (relErr) notes.push(`release_at order ${o.id}: ${relErr.message}`);
    }
  }

  const now = new Date().toISOString();
  const { error: markErr } = await admin
    .from("escrow_entries")
    .update({ status: "releasable", updated_at: now })
    .eq("status", "escrow_pending")
    .lte("release_at", now);
  if (markErr) notes.push(`mark releasable: ${markErr.message}`);

  const { count: pendingCount } = await admin.from("escrow_entries").select("id", { count: "exact", head: true }).eq("status", "escrow_pending");
  const { count: releasableCount } = await admin.from("escrow_entries").select("id", { count: "exact", head: true }).eq("status", "releasable");

  return {
    created,
    stats: {
      paid_bookings_found: bookingCandidates,
      bookings_skipped_no_amount: bookingSkippedNoAmount,
      paid_orders_found: orderCandidates,
      orders_skipped_no_amount: orderSkippedNoAmount,
      escrow_pending: pendingCount || 0,
      escrow_releasable: releasableCount || 0,
    },
    notes,
  };
}

export async function payOutReleasable() {
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("escrow_entries").select("*").eq("status", "releasable");
  if (error) return { paid: [], skipped: [`escrow releasable query: ${error.message}`] };

  const groups = new Map();
  for (const row of rows || []) {
    const key = `${row.provider_type}:${row.provider_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const paid = [];
  const skipped = [];
  if (!groups.size) skipped.push("no_releasable_entries");

  for (const [, list] of groups) {
    const first = list[0];
    const q = admin.from("stripe_connect_accounts").select("*").eq("kind", first.provider_type === "sitter" ? "sitter" : "shop");
    const acct = first.provider_type === "sitter"
      ? (await q.eq("sitter_id", first.provider_id).maybeSingle()).data
      : (await q.eq("shop_id", first.provider_id).maybeSingle()).data;
    if (!acct?.stripe_account_id || !acct.charges_enabled) {
      skipped.push(`${first.provider_type}:${first.provider_id}:no_onboarded_account`);
      continue;
    }
    const net = list.reduce((sum, r) => sum + (r.net_cents || 0), 0);
    if (net <= 0) {
      skipped.push(`${first.provider_type}:${first.provider_id}:nothing_to_pay`);
      continue;
    }
    try {
      const stripe = new (await import("stripe")).default(process.env.STRIPE_SECRET_KEY);
      const transfer = await stripe.transfers.create({
        amount: net,
        currency: (first.currency || "cad").toLowerCase(),
        destination: acct.stripe_account_id,
        metadata: {
          provider_type: first.provider_type,
          provider_id: first.provider_id,
          entry_ids: list.map((r) => r.id).join(","),
        },
      });
      const now = new Date().toISOString();
      await admin
        .from("escrow_entries")
        .update({ status: "released", stripe_transfer_id: transfer.id, released_at: now, updated_at: now })
        .in("id", list.map((r) => r.id));
      paid.push({ provider: `${first.provider_type}:${first.provider_id}`, net, transfer: transfer.id });
    } catch (err) {
      skipped.push(`${first.provider_type}:${first.provider_id}:${err.message}`);
    }
  }

  return { paid, skipped };
}

export async function runEscrowSettlement({ payOut = false } = {}) {
  const synced = await syncEscrowFromPaidActivity();
  const payouts = payOut ? await payOutReleasable() : { paid: [], skipped: ["payout_not_requested"] };
  return {
    ok: true,
    message:
      synced.created.length || payouts.paid.length
        ? "Settlement ran and made changes."
        : "Cron reached the app. Nothing was ready to escrow or pay out yet.",
    ...synced,
    ...payouts,
  };
}
