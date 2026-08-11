import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SitterBookingsClient from "./SitterBookingsClient";
export const metadata = { title: "Booking requests | Paw Sitter" };
export default async function SitterBookingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/sitter/bookings");
  if (profile.role !== "sitter" && profile.role !== "admin") redirect("/account");
  const supabase = await createClient();
  const { data: sitter } = await supabase
    .from("sitters").select("id").eq("profile_id", profile.id).maybeSingle();
  if (!sitter && profile.role !== "admin") {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-[#7a5c4e]">No sitter profile linked.</div>;
  }
  let q = supabase
    .from("bookings")
    .select("id, service_type, status, estimated_total, pet_notes, customer_notes, created_at, customer_id, booking_slots(*)")
    .order("created_at", { ascending: false });
  if (sitter) q = q.eq("sitter_id", sitter.id);
  const { data: bookings } = await q;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Booking requests</h1>
      <SitterBookingsClient initialBookings={bookings || []} />
    </div>
  );
}
