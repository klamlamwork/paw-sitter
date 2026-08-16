import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_TYPES } from "@/lib/shopInventory";
import RatingOptionsClient from "./RatingOptionsClient";

export const metadata = { title: "Rating options | Paw Sitter" };

export default async function RatingOptionsPage() {
  const profile = await requireRole("admin");
  if (!profile) redirect("/login?next=/admin/shop/rating-options");
  const supabase = await createClient();
  const { data: options } = await supabase
    .from("shop_rating_options")
    .select("id, product_type, label, description, icon_url, sort_order")
    .order("sort_order");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop admin</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Product rating options</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">These use the same required product types as create/edit product (Food, Treats, Toys…). Buyers only see options for that product’s type.</p>
      <RatingOptionsClient productTypes={PRODUCT_TYPES} initialOptions={options || []} />
    </div>
  );
}
