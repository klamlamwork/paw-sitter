import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ShopPortalClient from "./ShopPortalClient";
import ExpiringSoonPanel from "./ExpiringSoonPanel";

export const metadata = { title: "My shop | Paw Sitter" };

export default async function AccountShopPortalPage() {
  let profile;
  try {
    profile = await getProfile();
  } catch {
    redirect("/login?next=/account/shop");
  }
  if (!profile) redirect("/login?next=/account/shop");

  let shops = [];
  let products = [];
  let categories = [];
  let productBrandShops = [];
  let expiringRows = [];
  let loadNote = "";

  try {
    const supabase = await createClient();
    const shopsRes = await supabase
      .from("shop_shops")
      .select("id, name, slug, status, is_product_brand, owner_profile_id")
      .eq("owner_profile_id", profile.id)
      .order("name");
    shops = shopsRes.data || [];
    if (shopsRes.error) loadNote = shopsRes.error.message;

    const shopIds = shops.map((s) => s.id);
    if (shopIds.length) {
      const [prim, brand] = await Promise.all([
        supabase
          .from("shop_products")
          .select(
            "id, name, slug, status, brand_shop_id, primary_shop_id, short_description, description, price_cents, hide_price, category_id, show_affiliate, show_add_to_cart, affiliate_url, updated_at"
          )
          .in("primary_shop_id", shopIds)
          .order("updated_at", { ascending: false }),
        supabase
          .from("shop_products")
          .select(
            "id, name, slug, status, brand_shop_id, primary_shop_id, short_description, description, price_cents, hide_price, category_id, show_affiliate, show_add_to_cart, affiliate_url, updated_at"
          )
          .in("brand_shop_id", shopIds)
          .order("updated_at", { ascending: false }),
      ]);
      const map = new Map();
      for (const p of [...(prim.data || []), ...(brand.data || [])]) map.set(p.id, p);
      products = [...map.values()];
      if (!products.length && (prim.error || brand.error)) {
        loadNote = (prim.error || brand.error).message;
      }
    }

    const catsRes = await supabase
      .from("shop_categories")
      .select("id, name, parent_id, sort_order")
      .order("name");
    categories = catsRes.data || [];

    const brandsRes = await supabase
      .from("shop_shops")
      .select("id, name, slug")
      .eq("is_product_brand", true)
      .eq("status", "active")
      .order("name");
    productBrandShops = brandsRes.data || [];
  } catch (e) {
    loadNote = e?.message || "Could not load extra shop data.";
  }

  const productsFull = products.map((p) => ({
    ...p,
    product_type: p.product_type || "other",
    inventory_mode: p.inventory_mode || "simple",
    show_affiliate: !!p.show_affiliate,
    show_add_to_cart: !!p.show_add_to_cart,
    affiliate_url: p.affiliate_url || "",
    edit_name: p.name,
    edit_slug: p.slug,
    edit_short_description: p.short_description,
    edit_description: p.description,
    edit_price_cents: p.price_cents,
    edit_hide_price: p.hide_price,
    edit_category_ids: p.category_id ? [p.category_id] : [],
    edit_product_type: "other",
    edit_inventory_mode: "simple",
    media: [],
    longevity_items: [],
    variants: [],
    has_pending_edit: false,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/account" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Account
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop portal</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">Signed in as {profile.email}</p>
      <p className="mt-2 text-sm">
        <Link href="/account/shop/orders" className="font-semibold text-[#c45c26] hover:underline">
          Incoming orders
        </Link>
      </p>
      {loadNote ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{loadNote}</p>
      ) : null}

      {!shops.length ? (
        <p className="mt-6 text-sm text-[#5c4033]">
          No shop is linked to this account. Ask an admin to set you as shop owner.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {shops.map((s) => (
            <li key={s.id} className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-[#7a5c4e]">
                {s.is_product_brand ? "Product brand" : "Retailer"} · {s.status}
              </p>
            </li>
          ))}
        </ul>
      )}

      <ExpiringSoonPanel rows={expiringRows} />

      <ShopPortalClient
        shops={shops}
        initialProducts={productsFull}
        categories={categories}
        productBrandShops={productBrandShops}
        profileId={profile.id}
      />
    </div>
  );
}
