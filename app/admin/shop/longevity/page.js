import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import LongevityAdminClient from "./LongevityAdminClient";

export const metadata = { title: "Admin Longevity highlights | Paw Sitter" };

export default async function AdminLongevityPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/shop/longevity");
  if (profile.role !== "admin") redirect("/account");

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("shop_longevity_highlights")
    .select("*")
    .order("sort_order")
    .order("label");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop admin
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Longevity highlights</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Shops can only pick from this list when creating products. Upload a custom icon or keep the
        preset emoji.
      </p>
      <p className="mt-2 text-xs text-[#7a5c4e]">
        Run <code className="rounded bg-[#fff8f0] px-1">sql/48-shop-longevity-highlights.sql</code> in
        Supabase first.
      </p>
      <LongevityAdminClient initialItems={items || []} />
    </div>
  );
}
