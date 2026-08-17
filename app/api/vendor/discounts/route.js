import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function sitterProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("sitters").select("id, profile_id").eq("profile_id", user.id).maybeSingle();
  return data;
}

async function shopProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("shop_shops").select("id, owner_profile_id").eq("owner_profile_id", user.id).maybeSingle();
  return data;
}

export async function GET(request) {
  const admin = createAdminClient();
  const sitter = await sitterProfile();
  const shop = await shopProfile();
  const q = admin.from("discount_codes").select("*").eq("active", true);
  if (sitter) q.eq("vendor_sitter_id", sitter.id);
  else if (shop) q.eq("vendor_shop_id", shop.id);
  else return NextResponse.json({ error: "No vendor profile." }, { status: 403 });
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data || [] });
}

export async function POST(request) {
  const admin = createAdminClient();
  const sitter = await sitterProfile();
  const shop = await shopProfile();
  if (!sitter && !shop) return NextResponse.json({ error: "No vendor profile." }, { status: 403 });
  const body = await request.json();
  const payload = {
    code: String(body.code || "").trim().toUpperCase(),
    label: body.label || null,
    kind: "vendor",
    scope: sitter ? "booking" : "shop_order",
    type: body.type || "percent",
    currency: "CAD",
    percent_off: body.percent_off ? Number(body.percent_off) : null,
    fixed_off_cents: body.fixed_off_cents ? Number(body.fixed_off_cents) : null,
    min_spend_cents: body.min_spend_cents ? Number(body.min_spend_cents) : null,
    vendor_sitter_id: sitter ? sitter.id : null,
    vendor_shop_id: shop ? shop.id : null,
    category_ids: null,
    first_booking_only: !!body.first_booking_only,
    applies_to_shipping: !!body.applies_to_shipping,
    max_redemptions: body.max_redemptions ? Number(body.max_redemptions) : null,
    max_per_user: body.max_per_user ? Number(body.max_per_user) : 1,
    starts_at: new Date().toISOString(),
    expires_at: body.expires_at ? new Date(body.expires_at).toISOString() : null,
    funded_by_platform: false,
    platform_fee_absorbed_cents: 0,
    active: body.active !== false,
  };
  const { data, error } = await admin.from("discount_codes").insert(payload).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
