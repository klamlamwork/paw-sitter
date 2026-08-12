import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BrandsAdminClient from "./BrandsAdminClient";

export const metadata = { title: "Admin Shop Brands | Paw Sitter" };

export default async function AdminShopBrandsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/shop/brands");
  if (profile.role !== "admin") redirect("/account");
  const supabase = await createClient();
  const { data: brands } = await supabase.from("shop_brands").select("*").order("name");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop admin</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Brands</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">Product brands for “Shop by brand”.</p>
      <BrandsAdminClient initialBrands={brands || []} />
    </div>
  );
}
