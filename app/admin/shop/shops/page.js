import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ShopsAdminClient from "./ShopsAdminClient";

export const metadata = { title: "Admin Shops | Paw Sitter" };

export default async function AdminShopShopsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/shop/shops");
  if (profile.role !== "admin") redirect("/account");
  const supabase = await createClient();
  const [{ data: shops }, { data: brands }, { data: profiles }] = await Promise.all([
    supabase.from("shop_shops").select("*, shop_brands(name)").order("name"),
    supabase.from("shop_brands").select("id, name").order("name"),
    supabase.from("profiles").select("id, email, full_name").order("email").limit(200),
  ]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop admin</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shops</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">Vendors and brand shops · public URL /shop/shops/[slug]</p>
      <ShopsAdminClient initialShops={shops || []} brands={brands || []} profiles={profiles || []} />
    </div>
  );
}
