import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function origin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function startConnectOnboarding({ profile, kind, sitterId, shopId }) {
  const admin = createAdminClient();
  let query = admin.from("stripe_connect_accounts").select("*");
  query = kind === "sitter" ? query.eq("sitter_id", sitterId) : query.eq("shop_id", shopId);
  let { data: row } = await query.maybeSingle();

  const client = stripe();
  if (!row) {
    const account = await client.accounts.create({
      type: "express",
      country: "CA",
      email: profile.email || undefined,
      capabilities: { transfers: { requested: true } },
      metadata: { kind, profile_id: profile.id, sitter_id: sitterId || "", shop_id: shopId || "" },
    });
    const insert = await admin.from("stripe_connect_accounts").insert({
      owner_profile_id: profile.id,
      kind,
      sitter_id: sitterId || null,
      shop_id: shopId || null,
      stripe_account_id: account.id,
    }).select("*").single();
    if (insert.error) throw insert.error;
    row = insert.data;
  }

  const account = await client.accounts.retrieve(row.stripe_account_id);
  await admin.from("stripe_connect_accounts").update({
    details_submitted: !!account.details_submitted,
    payouts_enabled: !!account.payouts_enabled,
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);

  const returnPath = kind === "sitter" ? "/sitter/payouts" : "/account/shop/payouts";
  const link = await client.accountLinks.create({
    account: row.stripe_account_id,
    refresh_url: `${origin()}${returnPath}?refresh=1`,
    return_url: `${origin()}${returnPath}?onboarded=1`,
    type: "account_onboarding",
  });
  return { url: link.url, payouts_enabled: !!account.payouts_enabled, details_submitted: !!account.details_submitted };
}

export async function connectStatus({ kind, sitterId, shopId }) {
  const admin = createAdminClient();
  let query = admin.from("stripe_connect_accounts").select("*");
  query = kind === "sitter" ? query.eq("sitter_id", sitterId) : query.eq("shop_id", shopId);
  const { data: row } = await query.maybeSingle();
  if (!row) return { connected: false, payouts_enabled: false };
  try {
    const account = await stripe().accounts.retrieve(row.stripe_account_id);
    const payouts_enabled = !!account.payouts_enabled;
    await admin.from("stripe_connect_accounts").update({
      details_submitted: !!account.details_submitted,
      payouts_enabled,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    return { connected: true, payouts_enabled, details_submitted: !!account.details_submitted };
  } catch {
    return { connected: true, payouts_enabled: !!row.payouts_enabled, details_submitted: !!row.details_submitted };
  }
}
