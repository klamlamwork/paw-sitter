import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brandShopPath, shopPath } from "@/lib/shop";
import { enrichProducts, sortCategoriesForFilters } from "@/lib/shopCatalog";
import ShopEntitySlider from "./ShopHomeSliders";
import ShopProductsPanel from "./ShopProductsPanel";

export const metadata = {
  title: "Shop | Paw Sitter",
  description: "Longevity-minded products for pets — brands and retailers on Paw Sitter.",
};

function sortHomeList(rows, sortKey) {
  return [...(rows || [])].sort((a, b) => {
    const sa = a[sortKey];
    const sb = b[sortKey];
    const aHas = sa != null && sa !== "";
    const bHas = sb != null && sb !== "";
    if (aHas && bHas) return Number(sa) - Number(sb) || a.name.localeCompare(b.name);
    if (aHas) return -1;
    if (bHas) return 1;
    return a.name.localeCompare(b.name);
  });
}

export default async function ShopHomePage() {
  const supabase = await createClient();

  let brandShopsRaw = [];
  let shopsRaw = [];
  let productsRaw = [];
  let categories = [];

  try {
    const [brandsRes, shopsRes, productsRes, catsRes] = await Promise.all([
      supabase
        .from("shop_shops")
        .select("id, name, slug, logo_url, is_product_brand, home_brand_sort")
        .eq("is_product_brand", true)
        .eq("status", "active"),
      supabase
        .from("shop_shops")
        .select("id, name, slug, logo_url, is_product_brand, home_retailer_sort")
        .eq("status", "active")
        .eq("is_product_brand", false),
      supabase
        .from("shop_products")
        .select(
          "id, name, slug, short_description, price_cents, currency, hide_price, brand_shop_id, category_id, updated_at"
        )
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("shop_categories")
        .select("id, name, slug, sort_order, filter_row, parent_id")
        .order("sort_order")
        .order("name"),
    ]);
    brandShopsRaw = brandsRes.data || [];
    shopsRaw = shopsRes.data || [];
    productsRaw = productsRes.data || [];
    categories = catsRes.data || [];
  } catch {
    brandShopsRaw = [];
    shopsRaw = [];
    productsRaw = [];
    categories = [];
  }

  const brandShops = sortHomeList(brandShopsRaw, "home_brand_sort").slice(0, 10);
  const shops = sortHomeList(shopsRaw, "home_retailer_sort").slice(0, 10);

  const brandItems = brandShops.map((b) => ({
    id: b.id,
    name: b.name,
    logoUrl: b.logo_url,
    href: brandShopPath(b),
  }));
  const retailerItems = shops.map((s) => ({
    id: s.id,
    name: s.name,
    logoUrl: s.logo_url,
    href: shopPath(s),
  }));

  let products = [];
  let coverByProduct = {};
  let longevityLabels = [];
  try {
    const enriched = await enrichProducts(supabase, productsRaw || []);
    products = enriched.products || [];
    coverByProduct = enriched.coverByProduct || {};
    longevityLabels = enriched.longevityLabels || [];
  } catch {
    products = (productsRaw || []).map((p) => ({
      ...p,
      category_ids: p.category_id ? [p.category_id] : [],
      longevity_labels: [],
    }));
  }

  const { categoriesRow1, categoriesRow2 } = sortCategoriesForFilters(categories);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#3b2a22] sm:text-4xl">Shop</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#7a5c4e]">
            Product brands and retailers in one place.
          </p>
        </div>
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#3b2a22]">Shop by brand</h2>
          <Link href="/shop/brands" className="text-xs font-semibold text-[#c45c26] hover:underline">
            All brands →
          </Link>
        </div>
        <ShopEntitySlider items={brandItems} emptyLabel="No product brands yet." />
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#3b2a22]">Retailers</h2>
          <Link href="/shop/shops" className="text-xs font-semibold text-[#c45c26] hover:underline">
            All shops →
          </Link>
        </div>
        <ShopEntitySlider items={retailerItems} emptyLabel="No retailer shops yet." />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Products</h2>
        <ShopProductsPanel
          products={products}
          coverByProduct={coverByProduct}
          categoriesRow1={categoriesRow1}
          categoriesRow2={categoriesRow2}
          longevityLabels={longevityLabels}
        />
      </section>
    </div>
  );
}
