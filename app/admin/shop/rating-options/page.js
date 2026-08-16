import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import RatingOptionsClient from "./RatingOptionsClient";

export const metadata = { title: "Rating options | Paw Sitter" };

export default async function RatingOptionsPage() {
  const profile = await requireRole("admin");
  if (!profile) redirect("/login?next=/admin/shop/rating-options");
  const supabase = await createClient();
  const [{ data: categories }, { data: options }] = await Promise.all([
    supabase.from("shop_categories").select("id, name").order("name"),
    supabase.from("shop_rating_options").select("id, category_id, label, description, icon_url, sort_order").order("sort_order"),
  ]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop admin</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Product rating options</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Create tick options per category, such as Food → Tasty. Buyers can tick any that apply on a verified review.</p>
      <RatingOptionsClient categories={categories || []} initialOptions={options || []} />
    </div>
  );
}
