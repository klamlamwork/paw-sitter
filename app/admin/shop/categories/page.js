import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CategoriesAdminClient from "./CategoriesAdminClient";

export const metadata = { title: "Admin Shop Categories | Paw Sitter" };

export default async function AdminShopCategoriesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/shop/categories");
  if (profile.role !== "admin") redirect("/account");
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("shop_categories")
    .select("*")
    .order("filter_row")
    .order("sort_order")
    .order("name");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop admin
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Categories</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Catalog groups. On /shop/ Products, filters use <strong>two lines</strong> — set filter
        line + sequence for each category.
      </p>
      <CategoriesAdminClient initialCategories={categories || []} />
    </div>
  );
}
