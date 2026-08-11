import { redirect } from "next/navigation";
import Link from "next/link";
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
        <p className="mt-3 text-[#7a5c4e]">No sitter profile linked to <strong>{profile.email}</strong>.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Sitter dashboard</h1>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link className="font-semibold text-[#c45c26] hover:underline" href="/sitter/calendar">Availability calendar</Link>
        <Link className="font-semibold text-[#c45c26] hover:underline" href="/sitter/bookings">Booking requests</Link>
      </div>
      <p className="mt-2 text-sm text-[#7a5c4e]">Weekly hours below are the default. Use the calendar for specific days and services.</p>
      <SitterDashboardClient sitter={sitter} />
    </div>
  );
}
