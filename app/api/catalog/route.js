import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || "";
  const brand = (searchParams.get("brand") || "").trim();
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const admin = createAdminClient();
  let query = admin.from("product_catalog").select("id, category, brand, name, species, is_longevity_partner").eq("active", true).limit(200);
  if (category) query = query.eq("category", category);
  if (brand) query = query.eq("brand", brand);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const products = (data || []).filter((p) => !q || `${p.brand} ${p.name}`.toLowerCase().includes(q));
  const brands = [...new Set((data || []).map((p) => p.brand).filter(Boolean))].sort();
  return NextResponse.json({ brands, products });
}
