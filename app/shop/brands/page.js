import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brandPath } from "@/lib/shop";

export const metadata = {
  title: "Shop by brand | Paw Sitter",
  description: "Browse product brands focused on dog and cat longevity.",
};

export default async function ShopBrandsIndexPage() {
  const supabase = await createClient();
  const { data: brands } = await supabase.from("shop_brands").select("id, name, slug, logo_url, description, is_featured").order("name");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop by brand</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Product brands you can filter and trust.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(brands || []).map((b) => (
          <li key={b.id}>
            <Link href={brandPath(b.slug)} className="flex gap-3 rounded-2xl border border-[#e8d5c4] bg-white p-4 hover:border-[#c45c26]/50">
              {b.logo_url ? (
                <img src={b.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#fff1e6] text-sm font-bold text-[#c4a484]">
                  {(b.name || "?").slice(0, 1)}
                </div>
              )}
              <div>
                <p className="font-semibold text-[#3b2a22]">{b.name}</p>
                {b.is_featured ? <p className="text-[10px] font-bold uppercase text-[#c45c26]">Featured</p> : null}
                {b.description ? <p className="mt-1 line-clamp-2 text-xs text-[#7a5c4e]">{b.description}</p> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {!brands?.length ? <p className="mt-6 text-sm text-[#7a5c4e]">No brands yet. Add in Admin → Shop.</p> : null}
    </div>
  );
}
