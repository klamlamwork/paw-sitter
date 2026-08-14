import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ShopsAdminClient from "./ShopsAdminClient";

export const metadata = { title: "Admin Shops | Paw Sitter" };

export default async function AdminShopShopsPage({ searchParams }) {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/shop/shops");
  if (profile.role !== "admin") redirect("/account");

  const sp = await searchParams;
  const filter = sp?.filter === "product_brand" ? "product_brand" : "all";

  const supabase = await createClient();
  let shopsQuery = supabase.from("shop_shops").select("*").order("name");
  if (filter === "product_brand") {
    shopsQuery = shopsQuery.eq("is_product_brand", true);
  }
  const [{ data: shops }, { data: profiles }] = await Promise.all([
    shopsQuery,
    supabase.from("profiles").select("id, email, full_name").order("email").limit(500),
  ]);

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const shopsWithOwner = (shops || []).map((s) => ({
    ...s,
    owner: s.owner_profile_id ? profileMap[s.owner_profile_id] || null : null,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop admin
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">
        {filter === "product_brand" ? "Product brand shops" : "Shops"}
      </h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Create, edit every shop field, or delete a shop. Assign an owner so they can use Account → Shop.
      </p>
      <p className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
        <Link
          href="/admin/shop/shops"
          className={filter === "all" ? "text-[#c45c26]" : "text-[#7a5c4e] hover:underline"}
        >
          All shops
        </Link>
        <Link
          href="/admin/shop/shops?filter=product_brand"
          className={
            filter === "product_brand" ? "text-[#c45c26]" : "text-[#7a5c4e] hover:underline"
          }
        >
          Product brands only
        </Link>
      </p>
      <ShopsAdminClient
        initialShops={shopsWithOwner}
        profiles={profiles || []}
        defaultProductBrand={filter === "product_brand"}
      />
    </div>
  );
}
