import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PawPointsAdminClient from "./PawPointsAdminClient";

export const metadata = { title: "Paw Points | Admin" };

export default async function AdminPawPointsPage() {
  const profile = await requireRole("admin");
  if (!profile) redirect("/login?next=/admin/paw-points");
  const supabase = await createClient();
  const [{ data: settings }, { data: rates }] = await Promise.all([
    supabase.from("paw_point_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("paw_point_earn_rates").select("*").order("label"),
  ]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Paw Points</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">1 point = $0.002. Earn is pending until fulfillment. Redeem min 100 points, max 40% of order.</p>
      <PawPointsAdminClient settings={settings} rates={rates || []} />
    </div>
  );
}
