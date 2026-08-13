import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brandShopPath, shopPath } from "@/lib/shop";
import ShopPortalClient from "./ShopPortalClient";

export const metadata = { title: "My shop | Paw Sitter" };

export default async function AccountShopPortalPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account/shop");

  const supabase = await createClient();
  const { data: shops } = await supabase
    .from("shop_shops")
    .select("*")
    .eq("owner_profile_id", profile.id)
    .order("name");

  const myShops = shops || [];

  if (!myShops.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link href="/account" className="text-sm font-semibold text-[#c45c26] hover:underline">
          &larr; Account
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop portal</h1>
        <p className="mt-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] px-4 py-3 text-sm text-[#5c4033]">
          No shop is linked to <strong>{profile.email}</strong> yet. Ask an admin to open{" "}
          <span className="font-semibold">Admin → Shop → Shops</span>, create or edit your shop,
          and set <strong>Owner account</strong> to this email. Shop must be <strong>active</strong>.
        </p>
      </div>
    );
  }

  const brandShopIds = myShops.filter((s) => s.is_product_brand).map((s) => s.id);
  let products = [];
  if (brandShopIds.length) {
    const { data } = await supabase
      .from("shop_products")
      .select("id, name, slug, status, brand_shop_id, short_description, updated_at")
      .in("brand_shop_id", brandShopIds)
      .order("updated_at", { ascending: false });
    products = data || [];
  }

  const { data: categories } = await supabase
    .from("shop_categories")
    .select("id, name")
    .order("sort_order")
    .order("name");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/account" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Account
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop portal</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Signed in as {profile.email}. Create products as a product-brand shop; they go to admin for
        approval. Affiliate / cart CTAs expand in the next batch.
      </p>

      <ul className="mt-6 space-y-2">
        {myShops.map((s) => (
          <li
            key={s.id}
            className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm"
          >
            <p className="font-semibold text-[#3b2a22]">
              {s.name}{" "}
              <span className="text-[10px] font-bold uppercase text-[#c45c26]">
                {s.is_product_brand ? "Product brand" : "Retailer"}
              </span>{" "}
              <span className="text-[10px] uppercase text-[#7a5c4e]">{s.status}</span>
            </p>
            <p className="text-xs text-[#7a5c4e]">
              <Link href={shopPath(s)} className="text-[#c45c26] hover:underline">
                Public storefront
              </Link>
              {s.is_product_brand ? (
                <>
                  {" · "}
                  <Link href={brandShopPath(s)} className="text-[#c45c26] hover:underline">
                    Brand hub
                  </Link>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>

      <ShopPortalClient
        shops={myShops}
        initialProducts={products}
        categories={categories || []}
        profileId={profile.id}
      />
    </div>
  );
}
