import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin Shop | Paw Sitter" };

export default async function AdminShopPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/shop");
  if (profile.role !== "admin") redirect("/account");

  const supabase = await createClient();
  const [{ count: brands }, { count: shops }, { count: products }, { count: pending }] =
    await Promise.all([
      supabase.from("shop_brands").select("id", { count: "exact", head: true }),
      supabase.from("shop_shops").select("id", { count: "exact", head: true }),
      supabase.from("shop_products").select("id", { count: "exact", head: true }),
      supabase.from("shop_products").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Shop admin</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">
        Phase 1A foundation. Phase 1B adds full CRUD for brands, shops, categories, and products.
      </p>
      <p className="mt-2 text-xs text-[#7a5c4e]">
        Run <code className="rounded bg-[#fff1e6] px-1">sql/20-shop-core.sql</code> in Supabase first.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Brands", brands ?? 0],
          ["Shops", shops ?? 0],
          ["Products", products ?? 0],
          ["Pending", pending ?? 0],
        ].map(([label, n]) => (
          <div key={label} className="rounded-2xl border border-[#e8d5c4] bg-white p-4 text-center">
            <dt className="text-xs font-semibold uppercase text-[#7a5c4e]">{label}</dt>
            <dd className="mt-1 text-2xl font-bold text-[#3b2a22]">{n}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-8 space-y-2 text-sm">
        <li className="rounded-xl border border-dashed border-[#e8d5c4] px-4 py-3 text-[#7a5c4e]">
          Brands / Shops / Categories / Products editors — Phase 1B
        </li>
        <li>
          <Link href="/shop" className="font-semibold text-[#c45c26] hover:underline">
            View public shop →
          </Link>
        </li>
      </ul>
    </div>
  );
}
