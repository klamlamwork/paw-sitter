import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || "";
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const admin = createAdminClient();
  let query = admin.from("product_catalog").select("id, category, brand, name, species, is_longevity_partner").eq("active", true).limit(40);
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data || []).filter((p) => !q || `${p.brand} ${p.name}`.toLowerCase().includes(q));
  return NextResponse.json({ products: rows });
}
