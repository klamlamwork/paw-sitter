import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AdminDiscountsClient from "./AdminDiscountsClient";

export const metadata = { title: "Admin Discounts | Paw Sitter" };

export default async function AdminDiscountsPage() {
  const profile = await requireRole("admin");
  if (!profile) redirect("/login?next=/admin/discounts");
  const supabase = await createClient();
  const { data: codes } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Admin - Discounts</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Create site-wide or category promos. Platform-funded codes reduce your service fee; vendor-funded codes reduce the vendor payout.</p>
      <AdminDiscountsClient initial={codes || []} />
    </div>
  );
}
