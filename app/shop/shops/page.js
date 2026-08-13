import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { shopPath } from "@/lib/shop";

export const metadata = {
  title: "Shops | Paw Sitter Shop",
  description: "Retailers and product brand shops on Paw Sitter.",
};

export default async function ShopShopsIndexPage() {
  const supabase = await createClient();
  const { data: shops } = await supabase
    .from("shop_shops")
    .select("id, name, slug, logo_url, description, is_product_brand, status")
    .eq("status", "active")
    .order("name");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shops</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">
        Retailers and product brands (same shop accounts — brands are flagged).
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {(shops || []).map((s) => (
          <li key={s.id}>
            <Link
              href={shopPath(s)}
              className="block rounded-2xl border border-[#e8d5c4] bg-white p-5 hover:border-[#c45c26]/50"
            >
              <span className="font-semibold text-[#3b2a22]">{s.name}</span>
              {s.is_product_brand ? (
                <span className="ml-2 text-[10px] font-bold uppercase text-[#c45c26]">
                  Product brand
                </span>
              ) : null}
              {s.description ? (
                <span className="mt-1 block text-xs text-[#7a5c4e]">{s.description}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {!(shops || []).length ? (
        <p className="mt-8 text-sm text-[#7a5c4e]">No shops yet.</p>
      ) : null}
    </div>
  );
}
