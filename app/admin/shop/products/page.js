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
  const [{ data: products }, { data: brands }, { data: shops }, { data: categories }] =
    await Promise.all([
      supabase
        .from("shop_products")
        .select("id, name, slug, status, price_cents, currency, hide_price, show_affiliate, show_add_to_cart, brand_id, primary_shop_id, category_id, updated_at, shop_brands(name), shop_shops(name)")
        .order("updated_at", { ascending: false }),
      supabase.from("shop_brands").select("id, name").order("name"),
      supabase.from("shop_shops").select("id, name, shop_type").order("name"),
      supabase.from("shop_categories").select("id, name").order("sort_order"),
    ]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop admin</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Products</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">Assign brand & shop; affiliate and/or add-to-cart; approve to publish.</p>
      <ProductsAdminClient
        initialProducts={products || []}
        brands={brands || []}
        shops={shops || []}
        categories={categories || []}
        adminId={profile.id}
      />
    </div>
  );
}
