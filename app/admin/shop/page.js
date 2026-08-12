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
  const [{ count: brands }, { count: shops }, { count: cats }, { count: products }, { count: pending }] =
    await Promise.all([
      supabase.from("shop_brands").select("id", { count: "exact", head: true }),
      supabase.from("shop_shops").select("id", { count: "exact", head: true }),
      supabase.from("shop_categories").select("id", { count: "exact", head: true }),
      supabase.from("shop_products").select("id", { count: "exact", head: true }),
      supabase.from("shop_products").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  const links = [
    { href: "/admin/shop/brands", label: "Brands", desc: "Ready · Shop by brand", ready: true },
    { href: "/admin/shop/shops", label: "Shops", desc: "Next · /shop/shops/…", ready: false },
    { href: "/admin/shop/categories", label: "Categories", desc: "Next", ready: false },
    { href: "/admin/shop/products", label: "Products", desc: "Next · approve & CTAs", ready: false },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Shop admin</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Phase 1B-1: Brands. More sections land in following batches.</p>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Brands", brands ?? 0],
          ["Shops", shops ?? 0],
          ["Categories", cats ?? 0],
          ["Products", products ?? 0],
          ["Pending", pending ?? 0],
        ].map(([label, n]) => (
          <div key={label} className="rounded-2xl border border-[#e8d5c4] bg-white p-3 text-center">
            <dt className="text-[10px] font-semibold uppercase text-[#7a5c4e]">{label}</dt>
            <dd className="mt-1 text-xl font-bold text-[#3b2a22]">{n}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-8 space-y-2">
        {links.map((l) =>
          l.ready ? (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex flex-col rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 hover:border-[#c45c26]/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-semibold text-[#3b2a22]">{l.label}</span>
                <span className="text-xs text-[#7a5c4e]">{l.desc}</span>
              </Link>
            </li>
          ) : (
            <li
              key={l.href}
              className="flex flex-col rounded-2xl border border-dashed border-[#e8d5c4] px-4 py-3 text-[#7a5c4e] sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-semibold">{l.label}</span>
              <span className="text-xs">{l.desc}</span>
            </li>
          )
        )}
      </ul>

      <p className="mt-6 text-sm">
        <Link href="/shop" className="font-semibold text-[#c45c26] hover:underline">
          View public shop →
        </Link>
      </p>
    </div>
  );
}
