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
          No shop is linked to <strong>{profile.email}</strong> yet.
        </p>
      </div>
    );
  }

  const shopIds = myShops.map((s) => s.id);

  const { data: byPrimary } = await supabase
    .from("shop_products")
    .select(
      "id, name, slug, status, brand_shop_id, primary_shop_id, short_description, description, price_cents, hide_price, category_id, has_pending_edit, pending_snapshot, updated_at"
    )
    .in("primary_shop_id", shopIds)
    .order("updated_at", { ascending: false });

  const { data: byBrand } = await supabase
    .from("shop_products")
    .select(
      "id, name, slug, status, brand_shop_id, primary_shop_id, short_description, description, price_cents, hide_price, category_id, has_pending_edit, pending_snapshot, updated_at"
    )
    .in("brand_shop_id", shopIds)
    .order("updated_at", { ascending: false });

  const map = new Map();
  for (const p of [...(byPrimary || []), ...(byBrand || [])]) map.set(p.id, p);
  const products = [...map.values()].sort(
    (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
  );

  const productIds = products.map((p) => p.id);
  let mediaByProduct = {};
  let longevityByProduct = {};
  let catsByProduct = {};
  if (productIds.length) {
    const [{ data: media }, { data: items }, { data: catLinks }] = await Promise.all([
      supabase
        .from("shop_product_media")
        .select("id, product_id, url, alt_text, sort_order")
        .in("product_id", productIds)
        .order("sort_order"),
      supabase
        .from("shop_product_longevity_items")
        .select("id, product_id, icon_key, label, note, sort_order")
        .in("product_id", productIds)
        .order("sort_order"),
      supabase
        .from("shop_product_categories")
        .select("product_id, category_id")
        .in("product_id", productIds),
    ]);
    for (const m of media || []) {
      if (!mediaByProduct[m.product_id]) mediaByProduct[m.product_id] = [];
      mediaByProduct[m.product_id].push(m);
    }
    for (const it of items || []) {
      if (!longevityByProduct[it.product_id]) longevityByProduct[it.product_id] = [];
      longevityByProduct[it.product_id].push(it);
    }
    for (const link of catLinks || []) {
      if (!catsByProduct[link.product_id]) catsByProduct[link.product_id] = [];
      catsByProduct[link.product_id].push(link.category_id);
    }
  }

  const productsFull = products.map((p) => {
    const liveMedia = mediaByProduct[p.id] || [];
    const liveLon = longevityByProduct[p.id] || [];
    const liveCats =
      catsByProduct[p.id] || (p.category_id ? [p.category_id] : []);
    const snap = p.has_pending_edit && p.pending_snapshot ? p.pending_snapshot : null;
    return {
      ...p,
      edit_name: snap?.name ?? p.name,
      edit_slug: snap?.slug ?? p.slug,
      edit_short_description: snap?.short_description ?? p.short_description,
      edit_description: snap?.description ?? p.description,
      edit_price_cents: snap?.price_cents ?? p.price_cents,
      edit_hide_price: snap?.hide_price ?? p.hide_price,
      edit_category_ids: snap?.category_ids || liveCats,
      media: snap?.media
        ? snap.media.map((m, i) => ({ ...m, id: m.id || `p-${i}`, product_id: p.id }))
        : liveMedia,
      longevity_items: snap?.longevity_items
        ? snap.longevity_items.map((it, i) => ({
            ...it,
            id: it.id || `l-${i}`,
            product_id: p.id,
          }))
        : liveLon,
    };
  });

  const [{ data: categories }, { data: productBrandShops }] = await Promise.all([
    supabase
      .from("shop_categories")
      .select("id, name, parent_id, sort_order")
      .order("sort_order")
      .order("name"),
    supabase
      .from("shop_shops")
      .select("id, name, slug")
      .eq("is_product_brand", true)
      .eq("status", "active")
      .order("name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/account" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Account
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop portal</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Signed in as {profile.email}. Edits to live products need admin approval before they go
        public.
      </p>

      <ul className="mt-6 space-y-2">
        {myShops.map((s) => (
          <li key={s.id} className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
            <p className="font-semibold text-[#3b2a22]">
              {s.name}{" "}
              <span className="text-[10px] font-bold uppercase text-[#c45c26]">
                {s.is_product_brand ? "Product brand" : "Retailer"}
              </span>
            </p>
            <p className="text-xs text-[#7a5c4e]">
              <Link href={shopPath(s)} className="text-[#c45c26] hover:underline">
                Storefront
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
        initialProducts={productsFull}
        categories={categories || []}
        productBrandShops={productBrandShops || []}
        profileId={profile.id}
      />
    </div>
  );
}
