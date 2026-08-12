import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatShopPrice, productPath } from "@/lib/shop";

export async function generateMetadata({ params }) {
  const { category } = await params;
  if (category === "all") return { title: "All categories | Shop | Paw Sitter" };
  const supabase = await createClient();
  const { data } = await supabase.from("shop_categories").select("name, seo_title, seo_description").eq("slug", category).maybeSingle();
  return {
    title: data?.seo_title || `${data?.name || "Category"} | Shop | Paw Sitter`,
    description: data?.seo_description || data?.name || "Shop products for pet longevity.",
  };
}

export default async function ShopCategoryPage({ params }) {
  const { category: slug } = await params;
  const supabase = await createClient();

  if (slug === "all") {
    const { data: cats } = await supabase.from("shop_categories").select("id, name, slug, description").order("sort_order");
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop</Link>
        <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Categories</h1>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(cats || []).map((c) => (
            <li key={c.id}>
              <Link href={`/shop/c/${c.slug}`} className="block rounded-2xl border border-[#e8d5c4] bg-white p-4 font-semibold text-[#3b2a22] hover:border-[#c45c26]/50">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
        {!cats?.length ? <p className="mt-4 text-sm text-[#7a5c4e]">No categories yet.</p> : null}
      </div>
    );
  }

  const { data: cat } = await supabase.from("shop_categories").select("*").eq("slug", slug).maybeSingle();
  const { data: products } = cat
    ? await supabase
        .from("shop_products")
        .select("id, name, slug, short_description, price_cents, currency, hide_price, shop_product_media(url, sort_order)")
        .eq("status", "approved")
        .eq("category_id", cat.id)
        .order("name")
    : { data: [] };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">{cat?.name || "Category"}</h1>
      {cat?.description ? <p className="mt-2 max-w-2xl text-sm text-[#7a5c4e]">{cat.description}</p> : null}
      {!cat ? <p className="mt-6 text-sm text-[#7a5c4e]">Category not found.</p> : null}
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(products || []).map((p) => {
          const img = (p.shop_product_media || []).sort((a, b) => a.sort_order - b.sort_order)[0]?.url;
          const price = formatShopPrice(p.price_cents, p.currency, p.hide_price);
          return (
            <li key={p.id}>
              <Link href={productPath(p.slug)} className="block overflow-hidden rounded-2xl border border-[#e8d5c4] bg-white hover:border-[#c45c26]/40">
                <div className="aspect-[4/3] bg-[#fff1e6]">
                  {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="p-4">
                  <p className="font-semibold text-[#3b2a22]">{p.name}</p>
                  {price ? <p className="mt-1 text-sm text-[#c45c26]">{price}</p> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {cat && !products?.length ? <p className="mt-6 text-sm text-[#7a5c4e]">No approved products in this category yet.</p> : null}
    </div>
  );
}
