import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ShopPortalClient from "./ShopPortalClient";
import ShippingSettingsForm from "./ShippingSettingsForm";

export const metadata = { title: "Shop portal | Paw Sitter" };

export default async function AccountShopPortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/shop");

  const { data: profile } = await supabase.from("profiles").select("id, email, role").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/login?next=/account/shop");

  const { data: shops } = await supabase.from("shop_shops").select("id, name, slug, status, is_product_brand").eq("owner_profile_id", user.id).order("name");
  if (!shops?.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link href="/account" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Account</Link>
        <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop portal</h1>
        <p className="mt-3 text-sm text-[#5c4033]">No shop linked to {profile.email}.</p>
      </div>
    );
  }

  const shopIds = shops.map((s) => s.id);
  const [{ data: byPrimary }, { data: byBrand }] = await Promise.all([
    supabase.from("shop_products").select("id, name, slug, status, brand_shop_id, primary_shop_id, short_description, description, price_cents, hide_price, category_id, product_type, inventory_mode, stock_qty, show_affiliate, show_add_to_cart, affiliate_url, updated_at").in("primary_shop_id", shopIds).order("updated_at", { ascending: false }),
    supabase.from("shop_products").select("id, name, slug, status, brand_shop_id, primary_shop_id, short_description, description, price_cents, hide_price, category_id, product_type, inventory_mode, stock_qty, show_affiliate, show_add_to_cart, affiliate_url, updated_at").in("brand_shop_id", shopIds).order("updated_at", { ascending: false }),
  ]);

  const products = [...(byPrimary || []), ...(byBrand || [])];
  const productIds = products.map((p) => p.id);
  let variantsByProduct = {};
  if (productIds.length) {
    const { data: variantRows } = await supabase.from("shop_product_variants").select("*").in("product_id", productIds).order("sort_order");
    for (const v of variantRows || []) {
      if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
      variantsByProduct[v.product_id].push(v);
    }
  }

  const productsFull = products.map((p) => ({
    ...p,
    inventory_mode: p.inventory_mode || "simple",
    product_type: p.product_type || "other",
    stock_qty: p.stock_qty ?? 0,
    show_affiliate: !!p.show_affiliate,
    show_add_to_cart: !!p.show_add_to_cart,
    affiliate_url: p.affiliate_url || "",
    edit_category_ids: p.category_id ? [p.category_id] : [],
    edit_product_type: p.product_type || "other",
    edit_inventory_mode: p.inventory_mode || "simple",
    media: [],
    longevity_items: [],
    variants: variantsByProduct[p.id] || [],
    has_pending_edit: false,
  }));

  const [{ data: categories }, { data: productBrandShops }] = await Promise.all([
    supabase.from("shop_categories").select("id, name, parent_id, sort_order").order("sort_order").order("name"),
    supabase.from("shop_shops").select("id, name, slug").eq("is_product_brand", true).eq("status", "active").order("name"),
  ]);

  const [{ data: settings }] = await Promise.all([
    supabase.from("shop_shipping_settings").select("*").in("shop_id", shopIds).limit(1).maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/account" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Account</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop portal</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">Product type controls stock mode. Variety/batch changes need no admin approval.</p>

      <div className="mt-6 flex gap-2">
        <a href="#products" className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white">Products</a>
        <a href="#shipping" className="rounded-full border border-[#c45c26] px-4 py-2 text-sm font-semibold text-[#c45c26]">Shipping</a>
      </div>

      <section id="products" className="mt-6">
        <ShopPortalClient
          shops={shops}
          products={productsFull}
          categories={categories || []}
          productBrandShops={productBrandShops || []}
        />
      </section>

      <section id="shipping" className="mt-10 border-t border-[#e8d5c4] pt-6">
        <ShippingSettingsForm shopId={shops[0].id} initial={settings} />
      </section>
    </div>
  );
}
