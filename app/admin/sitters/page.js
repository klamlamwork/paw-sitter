import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ensureSitterPaymentSettings } from "@/lib/sitterPayments";
import AdminSittersClient from "./AdminSittersClient";
import AdminPaymentsToggle from "./AdminPaymentsToggle";

export const metadata = { title: "Admin Sitters | Paw Sitter" };

export default async function AdminSittersPage() {
  const profile = await requireRole("admin");
  if (!profile) redirect("/login?next=/admin/sitters");
  const supabase = await createClient();
  const [{ data: sitters }, payments] = await Promise.all([
    supabase.from("sitters").select("*, sitter_services(*), sitter_gallery(*)").order("created_at", { ascending: false }),
    ensureSitterPaymentSettings().catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Admin - Sitters</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Add sitters by Google invite email.</p>
      <p className="mt-2 text-sm">
        <Link href="/admin/reviews" className="font-semibold text-[#c45c26] hover:underline">Moderate reviews</Link>
      </p>
      <AdminPaymentsToggle initial={payments} />
      <AdminSittersClient initialSitters={sitters || []} />
    </div>
  );
}
