import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ProductsModerateClient from "./ProductsModerateClient";

export const metadata = { title: "Admin Shop Products | Paw Sitter" };

export default async function AdminShopProductsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/shop/products");
  if (profile.role !== "admin") redirect("/account");

  const supabase = await createClient();
  const [{ data: products }, { data: retailers }] = await Promise.all([
    supabase
      .from("shop_products")
      .select(
        "id, name, slug, status, price_cents, currency, hide_price, brand_shop_id, category_id, created_by, has_pending_edit, pending_snapshot, pending_submitted_at, updated_at, created_at"
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("shop_shops")
      .select("id, name, slug, logo_url, is_product_brand, status")
      .eq("is_product_brand", false)
      .eq("status", "active")
      .order("name"),
  ]);

  const productIds = (products || []).map((p) => p.id);
  let offersByProduct = {};
  if (productIds.length) {
    const { data: offers } = await supabase
      .from("shop_product_offers")
      .select("id, product_id, shop_id, product_page_url, status, shop:shop_shops(id, name, slug, logo_url)")
      .in("product_id", productIds);
    for (const o of offers || []) {
      if (!offersByProduct[o.product_id]) offersByProduct[o.product_id] = [];
      offersByProduct[o.product_id].push(o);
    }
  }

  const brandIds = [...new Set((products || []).map((p) => p.brand_shop_id).filter(Boolean))];
  const catIds = [...new Set((products || []).map((p) => p.category_id).filter(Boolean))];
  const creatorIds = [...new Set((products || []).map((p) => p.created_by).filter(Boolean))];

  const [{ data: shops }, { data: cats }, { data: creators }] = await Promise.all([
    brandIds.length
      ? supabase.from("shop_shops").select("id, name, slug").in("id", brandIds)
      : Promise.resolve({ data: [] }),
    catIds.length
      ? supabase.from("shop_categories").select("id, name").in("id", catIds)
      : Promise.resolve({ data: [] }),
    creatorIds.length
      ? supabase.from("profiles").select("id, email, full_name").in("id", creatorIds)
      : Promise.resolve({ data: [] }),
  ]);

  const shopMap = Object.fromEntries((shops || []).map((s) => [s.id, s]));
  const catMap = Object.fromEntries((cats || []).map((c) => [c.id, c]));
  const creatorMap = Object.fromEntries((creators || []).map((c) => [c.id, c]));

  const rows = (products || []).map((p) => ({
    ...p,
    brand_shop: p.brand_shop_id ? shopMap[p.brand_shop_id] || null : null,
    category: p.category_id ? catMap[p.category_id] || null : null,
    creator: p.created_by ? creatorMap[p.created_by] || null : null,
    eligible_retailers: offersByProduct[p.id] || [],
  }));

  const pendingCount = rows.filter((p) => p.status === "pending" || p.has_pending_edit).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop admin
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Products</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Approve listings. For eligible retailers, paste a <strong>full https:// URL</strong> to that
        retailer&apos;s own product page (example:{" "}
        <code className="rounded bg-[#fff8f0] px-1">https://www.chewy.com/...</code>). Leave the URL
        blank to send shoppers to the retailer&apos;s Paw Sitter shop. Do not use /shop/shops/.../p/...
      </p>
      {pendingCount &gt; 0 ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          {pendingCount} need attention (new or update)
        </p>
      ) : null}
      <ProductsModerateClient
        initialProducts={rows}
        adminId={profile.id}
        retailers={retailers || []}
      />
    </div>
  );
}
