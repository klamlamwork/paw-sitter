import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brandShopPath, shopPath } from "@/lib/shop";
import { buildExpiringRows } from "@/lib/shopExpiring";
import ShopPortalClient from "./ShopPortalClient";
import ExpiringSoonPanel from "./ExpiringSoonPanel";

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
        <p className="mt-3 text-sm text-[#5c4033]">No shop linked to {profile.email}.</p>
      </div>
    );
  }

  const shopIds = myShops.map((s) => s.id);

  const productSelect =
    "id, name, slug, status, brand_shop_id, primary_shop_id, short_description, description, price_cents, hide_price, category_id, has_pending_edit, pending_snapshot, updated_at";

  const [{ data: byPrimary }, { data: byBrand }] = await Promise.all([
    supabase.from("shop_products").select(productSelect).in("primary_shop_id", shopIds).order("updated_at", { ascending: false }),
    supabase.from("shop_products").select(productSelect).in("brand_shop_id", shopIds).order("updated_at", { ascending: false }),
  ]);

  // Optional columns from later SQL — fetch separately so missing columns don't crash the page
  let typeById = {};
  const { data: typeRows } = await supabase
    .from("shop_products")
    .select("id, product_type, inventory_mode")
    .in("id", [...new Set([...(byPrimary || []), ...(byBrand || [])].map((p) => p.id))]);
  if (typeRows) {
    typeById = Object.fromEntries(typeRows.map((r) => [r.id, r]));
  }

  const map = new Map();
  for (const p of [...(byPrimary || []), ...(byBrand || [])]) {
    const extra = typeById[p.id] || {};
    map.set(p.id, {
      ...p,
      product_type: extra.product_type || "other",
      inventory_mode: extra.inventory_mode || "simple",
    });
  }
  const products = [...map.values()].sort(
    (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
  );

  const productIds = products.map((p) => p.id);
  let mediaByProduct = {};
  let longevityByProduct = {};
  let catsByProduct = {};
  let variantsByProduct = {};
  let expiringRows = [];

  if (productIds.length) {
    const [{ data: media }, { data: items }, { data: catLinks }, { data: variants }] =
      await Promise.all([
        supabase.from("shop_product_media").select("id, product_id, url, alt_text, sort_order").in("product_id", productIds).order("sort_order"),
        supabase.from("shop_product_longevity_items").select("id, product_id, icon_key, label, note, sort_order").in("product_id", productIds).order("sort_order"),
        supabase.from("shop_product_categories").select("product_id, category_id").in("product_id", productIds),
        supabase.from("shop_product_variants").select("*").in("product_id", productIds).order("sort_order"),
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
    for (const v of variants || []) {
      if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
      variantsByProduct[v.product_id].push(v);
    }

    const variantIds = (variants || []).map((v) => v.id);
    if (variantIds.length) {
      const { data: batches } = await supabase
        .from("shop_product_batches")
        .select("id, variant_id, lot_code, qty_on_hand, expiry_date, status")
        .in("variant_id", variantIds)
        .not("expiry_date", "is", null);
      if (batches) {
        const variantMap = Object.fromEntries((variants || []).map((v) => [v.id, v]));
        const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
        expiringRows = buildExpiringRows(batches, variantMap, productMap);
      }
    }
  }

  const productsFull = products.map((p) => {
    const snap = p.has_pending_edit && p.pending_snapshot ? p.pending_snapshot : null;
    return {
      ...p,
      inventory_mode: p.inventory_mode || "simple",
      product_type: p.product_type || "other",
      edit_name: snap?.name ?? p.name,
      edit_slug: snap?.slug ?? p.slug,
      edit_short_description: snap?.short_description ?? p.short_description,
      edit_description: snap?.description ?? p.description,
      edit_price_cents: snap?.price_cents ?? p.price_cents,
      edit_hide_price: snap?.hide_price ?? p.hide_price,
      edit_category_ids: snap?.category_ids || catsByProduct[p.id] || (p.category_id ? [p.category_id] : []),
      edit_product_type: snap?.product_type ?? p.product_type ?? "other",
      edit_inventory_mode: snap?.inventory_mode ?? p.inventory_mode ?? "simple",
      media: snap?.media || mediaByProduct[p.id] || [],
      longevity_items: snap?.longevity_items || longevityByProduct[p.id] || [],
      variants: variantsByProduct[p.id] || [],
    };
  });

  const [{ data: categories }, { data: productBrandShops }] = await Promise.all([
    supabase.from("shop_categories").select("id, name, parent_id, sort_order").order("sort_order").order("name"),
    supabase.from("shop_shops").select("id, name, slug").eq("is_product_brand", true).eq("status", "active").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/account" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Account
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop portal</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Product type controls stock mode. Variety / batch changes need no admin approval.
      </p>

      <ul className="mt-6 space-y-2">
        {myShops.map((s) => (
          <li key={s.id} className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
            <p className="font-semibold text-[#3b2a22]">{s.name}</p>
            <p className="text-xs text-[#7a5c4e]">
              <Link href={shopPath(s)} className="text-[#c45c26] hover:underline">Storefront</Link>
              {s.is_product_brand ? (
                <> · <Link href={brandShopPath(s)} className="text-[#c45c26] hover:underline">Brand hub</Link></>
              ) : null}
            </p>
          </li>
        ))}
      </ul>

      <ExpiringSoonPanel rows={expiringRows} />

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
