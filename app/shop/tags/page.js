import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Shop tags | Paw Sitter" };

export default async function ShopTagsPage() {
  const supabase = await createClient();
  const { data: tags } = await supabase.from("shop_tags").select("id, name, slug, description").eq("status", "active").order("name");
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Tags</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Browse products, reviews, education posts, and blog articles by tag.</p>
      <ul className="mt-6 flex flex-wrap gap-2">
        {(tags || []).map((tag) => (
          <li key={tag.id}>
            <Link href={`/shop/tags/${tag.slug}`} className="inline-block rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-sm font-semibold text-[#5c4033] hover:border-[#c45c26]">
              {tag.name}
            </Link>
          </li>
        ))}
      </ul>
      {!(tags || []).length ? <p className="mt-6 text-sm text-[#7a5c4e]">No tags yet.</p> : null}
    </div>
  );
}
