import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { searchApprovedProducts } from "@/lib/kolCommunity";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const url = new URL(request.url);
    const products = await searchApprovedProducts(url.searchParams.get("q") || "", { slug: url.searchParams.get("slug") || "" });
    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not search products." }, { status: 400 });
  }
}
