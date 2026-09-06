import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { listProductBrands, searchApprovedProducts } from "@/lib/kolCommunity";
import { optionsForProduct } from "@/lib/shopRatings";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const url = new URL(request.url);
    if (url.searchParams.get("brands") === "1") return NextResponse.json({ brands: await listProductBrands() });
    if (url.searchParams.get("options") === "1") {
      const ids = [...new Set((url.searchParams.get("product_ids") || "").split(",").map((id) => id.trim()).filter(Boolean))].slice(0, 10);
      const products = [];
      for (const id of ids) products.push({ id, options: await optionsForProduct(id) });
      return NextResponse.json({ products });
    }
    const products = await searchApprovedProducts(url.searchParams.get("q") || "", { slug: url.searchParams.get("slug") || "", brandId: url.searchParams.get("brand_id") || "" });
    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not search products." }, { status: 400 });
  }
}
