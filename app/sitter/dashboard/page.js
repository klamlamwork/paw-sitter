import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SitterDashboardClient from "./SitterDashboardClient";
export const metadata = { title: "Sitter dashboard | Paw Sitter" };
export default async function SitterDashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/sitter/dashboard");
  if (profile.role !== "sitter" && profile.role !== "admin") redirect("/account");
  const supabase = await createClient();
  const { data: sitter } = await supabase
    .from("sitters")
    .select("*, sitter_services(*), sitter_weekly_availability(*), sitter_gallery(*)")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!sitter) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold">Sitter dashboard</h1>
        <p className="mt-3 text-[#7a5c4e]">
          No sitter profile linked to <strong>{profile.email}</strong>. Ask admin to add this email.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Sitter dashboard</h1>
      <p className="mt-2 text-sm">
        <a className="font-semibold text-[#c45c26]" href="/sitter/bookings">View booking requests</a>
      </p>
      <SitterDashboardClient sitter={sitter} />
    </div>
  );
}
