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
  const { data: products } = await supabase
    .from("shop_products")
    .select(
      "id, name, slug, status, price_cents, currency, hide_price, brand_shop_id, category_id, created_by, has_pending_edit, pending_snapshot, pending_submitted_at, updated_at, created_at"
    )
    .order("updated_at", { ascending: false });

  const brandIds = [...new Set((products || []).map((p) => p.brand_shop_id).filter(Boolean))];
  const catIds = [...new Set((products || []).map((p) => p.category_id).filter(Boolean))];
  const creatorIds = [...new Set((products || []).map((p) => p.created_by).filter(Boolean))];

  const [{ data: shops }, { data: cats }, { data: creators }] = await Promise.all([
    brandIds.length
      ? supabase.from("shop_shops").select("id, name, slug, is_product_brand").in("id", brandIds)
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
  }));

  const pendingCount = rows.filter(
    (p) => p.status === "pending" || p.has_pending_edit
  ).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop admin
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Products</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Approve new listings or <strong>pending updates</strong>. Public keeps the last approved
        version until you approve an update.
      </p>
      {pendingCount > 0 ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          {pendingCount} need attention (new or update)
        </p>
      ) : null}
      <ProductsModerateClient initialProducts={rows} adminId={profile.id} />
    </div>
  );
}
