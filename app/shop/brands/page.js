import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brandShopPath } from "@/lib/shop";

export const metadata = {
  title: "Shop by brand | Paw Sitter Shop",
  description: "Browse product brands on Paw Sitter Shop.",
};

export default async function ShopBrandsIndexPage() {
  const supabase = await createClient();
  const { data: brands } = await supabase
    .from("shop_shops")
    .select("id, name, slug, logo_url, description, is_product_brand, status")
    .eq("is_product_brand", true)
    .eq("status", "active")
    .order("name");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop by brand</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">
        Product brands on Paw Sitter. Each brand is a shop marked as product brand — retailers
        can link the same products for multi-seller choice.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(brands || []).map((b) => (
          <li key={b.id}>
            <Link
              href={brandShopPath(b)}
              className="flex h-full flex-col rounded-2xl border border-[#e8d5c4] bg-white p-5 hover:border-[#c45c26]/50"
            >
              {b.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo_url} alt="" className="mb-3 h-12 w-auto object-contain" />
              ) : (
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#fff8f0] text-lg font-bold text-[#c45c26]">
                  {b.name.slice(0, 1)}
                </div>
              )}
              <span className="font-semibold text-[#3b2a22]">{b.name}</span>
              {b.description ? (
                <span className="mt-1 line-clamp-2 text-xs text-[#7a5c4e]">{b.description}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {!(brands || []).length ? (
        <p className="mt-8 text-sm text-[#7a5c4e]">No product brands yet.</p>
      ) : null}
    </div>
  );
}
