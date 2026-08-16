import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function toCents(amount) {
  const n = Number(amount) || 0;
  return Number.isInteger(n) && n >= 50 ? n : Math.round(n * 100);
}

function split(gross, pct) {
  const commission = Math.round(gross * (Number(pct) || 0) / 100);
  return { commission_cents: commission, net_cents: Math.max(0, gross - commission) };
}

async function settings(admin) {
  const { data } = await admin.from("platform_settings").select("*").eq("id", 1).maybeSingle();
  return {
    service_commission_pct: Number(data?.service_commission_pct ?? 10),
    shop_commission_pct: Number(data?.shop_commission_pct ?? 10),
  };
}

export async function syncEscrowFromPaidActivity() {
  const admin = createAdminClient();
  const cfg = await settings(admin);
  const created = [];

  const { data: bookings } = await admin
    .from("bookings")
    .select("id, sitter_id, status, payment_status, payment_received, estimated_total, stripe_payment_intent, sitters(profile_id)")
    .or("payment_status.in.(paid,authorized),payment_received.eq.true");
  for (const b of bookings || []) {
    const gross = toCents(b.estimated_total);
    if (!gross || !b.sitter_id) continue;
    const parts = split(gross, cfg.service_commission_pct);
    const { data: existing } = await admin.from("escrow_entries").select("id, status, release_at").eq("kind", "booking").eq("ref_id", b.id).maybeSingle();
    if (!existing) {
      await admin.from("escrow_entries").insert({
        kind: "booking",
        ref_id: b.id,
        provider_type: "sitter",
        provider_id: b.sitter_id,
        owner_profile_id: b.sitters?.profile_id || null,
        gross_cents: gross,
        commission_pct: cfg.service_commission_pct,
        ...parts,
        status: "escrow_pending",
        stripe_payment_intent: b.stripe_payment_intent || null,
        notes: "Held after buyer paid. Releases 48h after service completed.",
      });
      created.push(`booking:${b.id}`);
    }
    if (["completed", "complete"].includes(b.status)) {
      const release = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await admin.from("escrow_entries").update({
        release_at: existing?.release_at || release,
        updated_at: new Date().toISOString(),
      }).eq("kind", "booking").eq("ref_id", b.id).is("release_at", null).eq("status", "escrow_pending");
    }
  }

  const { data: orders } = await admin
    .from("shop_orders")
    .select("id, seller_shop_id, status, payment_status, stripe_payment_intent, shop:shop_shops!seller_shop_id(id, owner_profile_id), items:shop_order_items(qty, price_cents, currency)")
    .eq("payment_status", "paid");
  for (const o of orders || []) {
    const gross = (o.items || []).reduce((sum, i) => sum + (i.price_cents || 0) * (i.qty || 0), 0);
    if (!gross || !o.seller_shop_id) continue;
    const parts = split(gross, cfg.shop_commission_pct);
    const { data: existing } = await admin.from("escrow_entries").select("id, release_at").eq("kind", "shop_order").eq("ref_id", o.id).maybeSingle();
    if (!existing) {
      await admin.from("escrow_entries").insert({
        kind: "shop_order",
        ref_id: o.id,
        provider_type: "shop",
        provider_id: o.seller_shop_id,
        owner_profile_id: o.shop?.owner_profile_id || null,
        currency: o.items?.[0]?.currency || "CAD",
        gross_cents: gross,
        commission_pct: cfg.shop_commission_pct,
        ...parts,
        status: "escrow_pending",
        stripe_payment_intent: o.stripe_payment_intent || null,
        notes: "Held after buyer paid. Releases 14 days after delivery.",
      });
      created.push(`order:${o.id}`);
    }
    if (o.status === "delivered") {
      const release = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from("escrow_entries").update({
        release_at: existing?.release_at || release,
        updated_at: new Date().toISOString(),
      }).eq("kind", "shop_order").eq("ref_id", o.id).is("release_at", null).eq("status", "escrow_pending");
    }
  }

  const now = new Date().toISOString();
  await admin.from("escrow_entries").update({ status: "releasable", updated_at: now }).eq("status", "escrow_pending").lte("release_at", now);
  return { created };
}

export async function payOutReleasable() {
  const admin = createAdminClient();
  const { data: rows } = await admin.from("escrow_entries").select("*").eq("status", "releasable");
  const groups = new Map();
  for (const row of rows || []) {
    const key = `${row.provider_type}:${row.provider_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const paid = [];
  const skipped = [];
  for (const [, list] of groups) {
    const first = list[0];
    const q = admin.from("stripe_connect_accounts").select("*").eq("kind", first.provider_type === "sitter" ? "sitter" : "shop");
    const { data: acct } = first.provider_type === "sitter"
      ? await q.eq("sitter_id", first.provider_id).maybeSingle()
      : await q.eq("shop_id", first.provider_id).maybeSingle();
    if (!acct?.stripe_account_id || !acct.payouts_enabled) {
      skipped.push(`${first.provider_type}:${first.provider_id}:connect_incomplete`);
      continue;
    }
    const net = list.reduce((s, r) => s + (r.net_cents || 0), 0);
    if (net < 50) {
      skipped.push(`${first.provider_type}:${first.provider_id}:below_minimum`);
      continue;
    }
    try {
      const transfer = await stripe().transfers.create({
        amount: net,
        currency: (first.currency || "cad").toLowerCase(),
        destination: acct.stripe_account_id,
        metadata: { provider_type: first.provider_type, provider_id: first.provider_id, entry_ids: list.map((r) => r.id).join(",") },
      });
      const now = new Date().toISOString();
      await admin.from("escrow_entries").update({
        status: "released",
        stripe_transfer_id: transfer.id,
        released_at: now,
        updated_at: now,
      }).in("id", list.map((r) => r.id));
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
  return { ...synced, ...payouts };
}
