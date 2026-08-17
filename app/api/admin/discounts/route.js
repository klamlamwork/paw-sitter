import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function authorize() {
  try {
    const profile = await requireRole("admin");
    return !!profile;
  } catch {
    return false;
  }
}

export async function GET(request) {
  if (!(await authorize())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("discount_codes").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data || [] });
}

export async function POST(request) {
  if (!(await authorize())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const admin = createAdminClient();
  const payload = {
    code: String(body.code || "").trim().toUpperCase(),
    label: body.label || null,
    kind: body.kind || "admin",
    scope: body.scope || "site",
    type: body.type || "percent",
    currency: "CAD",
    percent_off: body.percent_off ? Number(body.percent_off) : null,
    fixed_off_cents: body.fixed_off_cents ? Number(body.fixed_off_cents) : null,
    min_spend_cents: body.min_spend_cents ? Number(body.min_spend_cents) : null,
    vendor_sitter_id: body.vendor_sitter_id || null,
    vendor_shop_id: body.vendor_shop_id || null,
    category_ids: body.category_ids || null,
    first_booking_only: !!body.first_booking_only,
    applies_to_shipping: !!body.applies_to_shipping,
    max_redemptions: body.max_redemptions ? Number(body.max_redemptions) : null,
    max_per_user: body.max_per_user ? Number(body.max_per_user) : 1,
    starts_at: body.starts_at ? new Date(body.starts_at).toISOString() : new Date().toISOString(),
    expires_at: body.expires_at ? new Date(body.expires_at).toISOString() : null,
    funded_by_platform: !!(body.kind === "admin" && body.funded_by_platform),
    platform_fee_absorbed_cents: body.platform_fee_absorbed_cents ? Number(body.platform_fee_absorbed_cents) : 0,
    active: body.active !== false,
  };
  const { data, error } = await admin.from("discount_codes").insert(payload).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function PATCH(request) {
  if (!(await authorize())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const admin = createAdminClient();
  const updates = {};
  if ("active" in body) updates.active = !!body.active;
  if ("label" in body) updates.label = body.label;
  if ("max_redemptions" in body) updates.max_redemptions = body.max_redemptions;
  if ("expires_at" in body) updates.expires_at = body.expires_at ? new Date(body.expires_at).toISOString() : null;
  const { error } = await admin.from("discount_codes").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
