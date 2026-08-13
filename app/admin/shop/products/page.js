import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ProductsAdminClient from "./ProductsAdminClient";

export const metadata = { title: "Admin Shop Products | Paw Sitter" };

export default async function AdminShopProductsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/shop/products");
  if (profile.role !== "admin") redirect("/account");

  const supabase = await createClient();
  const [{ data: products }, { data: brandShops }, { data: categories }] = await Promise.all([
    supabase
      .from("shop_products")
      .select(
        "id, name, slug, status, price_cents, currency, hide_price, brand_shop_id, category_id, updated_at, brand_shop:shop_shops!shop_products_brand_shop_id_fkey(id, name, slug), category:shop_categories(id, name)"
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("shop_shops")
      .select("id, name, slug")
      .eq("is_product_brand", true)
      .order("name"),
    supabase.from("shop_categories").select("id, name").order("sort_order").order("name"),
  ]);

  // Fallback if FK name differs — re-fetch simpler if needed
  let list = products;
  if (products === null) {
    const { data: simple } = await supabase
      .from("shop_products")
      .select(
        "id, name, slug, status, price_cents, currency, hide_price, brand_shop_id, category_id, updated_at"
      )
      .order("updated_at", { ascending: false });
    list = simple;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop admin
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Products</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Canonical product under a <strong>product brand</strong> shop. Retailer offers &
        affiliate/cart in the next batch (1B-4b).
      </p>
      <ProductsAdminClient
        initialProducts={list || []}
        brandShops={brandShops || []}
        categories={categories || []}
        adminId={profile.id}
      />
    </div>
  );
}
