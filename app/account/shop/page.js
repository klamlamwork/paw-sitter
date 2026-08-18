import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildExpiringRows } from "@/lib/shopExpiring";
import ShopPortalClient from "./ShopPortalClient";
import ExpiringSoonPanel from "./ExpiringSoonPanel";
import ShippingSettingsForm from "./ShippingSettingsForm";

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
  let shippingSettings = null;

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
      const select =
        "id, name, slug, status, brand_shop_id, primary_shop_id, short_description, description, price_cents, hide_price, category_id, product_type, inventory_mode, stock_qty, show_affiliate, show_add_to_cart, affiliate_url, has_pending_edit, pending_snapshot, updated_at";
      const [prim, brand] = await Promise.all([
        supabase.from("shop_products").select(select).in("primary_shop_id", shopIds).order("updated_at", { ascending: false }),
        supabase.from("shop_products").select(select).in("brand_shop_id", shopIds).order("updated_at", { ascending: false }),
      ]);
      const map = new Map();
      for (const p of [...(prim.data || []), ...(brand.data || [])]) map.set(p.id, p);
      products = [...map.values()];
      if (!products.length && (prim.error || brand.error)) {
        loadNote = (prim.error || brand.error).message;
      }

      const productIds = products.map((p) => p.id);
      let variantRows = [];
      if (productIds.length) {
        const [{ data: variantData }, { data: media }, { data: longevity }, { data: catLinks }] = await Promise.all([
          supabase.from("shop_product_variants").select("*").in("product_id", productIds).order("sort_order"),
          supabase.from("shop_product_media").select("id, product_id, url, alt_text, sort_order").in("product_id", productIds).order("sort_order"),
          supabase.from("shop_product_longevity_items").select("id, product_id, icon_key, label, note, sort_order").in("product_id", productIds).order("sort_order"),
          supabase.from("shop_product_categories").select("product_id, category_id").in("product_id", productIds),
        ]);
        variantRows = variantData || [];
        const variantsByProduct = {};
        const mediaByProduct = {};
        const longevityByProduct = {};
        const catsByProduct = {};
        for (const v of variantRows) {
          if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
          variantsByProduct[v.product_id].push(v);
        }
        for (const m of media || []) {
          if (!mediaByProduct[m.product_id]) mediaByProduct[m.product_id] = [];
          mediaByProduct[m.product_id].push(m);
        }
        for (const it of longevity || []) {
          if (!longevityByProduct[it.product_id]) longevityByProduct[it.product_id] = [];
          longevityByProduct[it.product_id].push(it);
        }
        for (const link of catLinks || []) {
          if (!catsByProduct[link.product_id]) catsByProduct[link.product_id] = [];
          catsByProduct[link.product_id].push(link.category_id);
        }
        products = products.map((p) => ({
          ...p,
          variants: variantsByProduct[p.id] || [],
          media: mediaByProduct[p.id] || [],
          longevity_items: longevityByProduct[p.id] || [],
          category_ids: catsByProduct[p.id] || (p.category_id ? [p.category_id] : []),
        }));
      }

      const variantIds = variantRows.map((v) => v.id);
      if (variantIds.length) {
        const { data: batches } = await supabase
          .from("shop_product_batches")
          .select("id, variant_id, lot_code, qty_on_hand, expiry_date, status")
          .in("variant_id", variantIds)
          .not("expiry_date", "is", null);
        const variantMap = Object.fromEntries(variantRows.map((v) => [v.id, v]));
        const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
        expiringRows = buildExpiringRows(batches || [], variantMap, productMap);
      }

      const { data: settings } = await supabase.from("shop_shipping_settings").select("*").in("shop_id", shopIds).limit(1).maybeSingle();
      shippingSettings = settings;
    }

    const catsRes = await supabase.from("shop_categories").select("id, name, parent_id, sort_order").order("name");
    categories = catsRes.data || [];
    const brandsRes = await supabase.from("shop_shops").select("id, name, slug").eq("is_product_brand", true).eq("status", "active").order("name");
    productBrandShops = brandsRes.data || [];
  } catch (e) {
    loadNote = e?.message || "Could not load extra shop data.";
  }

  const productsFull = products.map((p) => {
    const snap = p.has_pending_edit && p.pending_snapshot ? p.pending_snapshot : null;
    return {
      ...p,
      product_type: p.product_type || "other",
      inventory_mode: p.inventory_mode || "simple",
      stock_qty: p.stock_qty ?? 0,
      show_affiliate: !!p.show_affiliate,
      show_add_to_cart: !!p.show_add_to_cart,
      affiliate_url: p.affiliate_url || "",
      edit_name: snap?.name ?? p.name,
      edit_slug: snap?.slug ?? p.slug,
      edit_short_description: snap?.short_description ?? p.short_description,
      edit_description: snap?.description ?? p.description,
      edit_price_cents: snap?.price_cents ?? p.price_cents,
      edit_hide_price: snap?.hide_price ?? p.hide_price,
      edit_category_ids: snap?.category_ids || p.category_ids || (p.category_id ? [p.category_id] : []),
      edit_product_type: snap?.product_type ?? p.product_type ?? "other",
      edit_inventory_mode: snap?.inventory_mode ?? p.inventory_mode ?? "simple",
      media: snap?.media || p.media || [],
      longevity_items: snap?.longevity_items || p.longevity_items || [],
      variants: p.variants || [],
      has_pending_edit: !!p.has_pending_edit,
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/account" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Account</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop portal</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">Signed in as {profile.email}. Product content edits need approval. Varieties and batches update live.</p>
      {loadNote ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{loadNote}</p> : null}

      {!shops.length ? (
        <p className="mt-6 text-sm text-[#5c4033]">No shop is linked to this account. Ask an admin to set you as shop owner.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {shops.map((s) => (
            <li key={s.id} className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-[#7a5c4e]">{s.is_product_brand ? "Product brand" : "Retailer"} · {s.status}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex gap-2">
        <a href="#products" className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white">Products</a>
        <a href="#shipping" className="rounded-full border border-[#c45c26] px-4 py-2 text-sm font-semibold text-[#c45c26]">Shipping</a>
      </div>

      <ExpiringSoonPanel rows={expiringRows} />

      <section id="products">
        <ShopPortalClient
          shops={shops}
          initialProducts={productsFull}
          categories={categories}
          productBrandShops={productBrandShops}
          profileId={profile.id}
        />
      </section>

      <section id="shipping" className="mt-10 border-t border-[#e8d5c4] pt-6">
        {shops[0] ? <ShippingSettingsForm shopId={shops[0].id} initial={shippingSettings} /> : null}
      </section>
    </div>
  );
}
