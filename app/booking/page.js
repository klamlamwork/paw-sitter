import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import BookingWizard from "@/components/booking/BookingWizard";
import { createClient } from "@/lib/supabase/server";
export const metadata = { title: "Book a sitter | Paw Sitter" };
export default async function BookingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/booking");
  const supabase = await createClient();
  const [{ data: sitters }, { data: services }, { data: weekly }, { data: overrides }, { data: holidays }] =
    await Promise.all([
      supabase.from("sitters").select("*").eq("is_active", true).order("display_name"),
      supabase.from("sitter_services").select("*").eq("enabled", true),
      supabase.from("sitter_weekly_availability").select("*"),
      supabase.from("sitter_date_overrides").select("*"),
      supabase.from("holiday_dates").select("holiday_date"),
    ]);
  const sitterIds = (sitters || []).map((s) => s.id);
  let busy = [];
  if (sitterIds.length) {
    const { data: busyBookings } = await supabase
      .from("bookings")
      .select("id, sitter_id, booking_slots(starts_at, ends_at)")
      .in("sitter_id", sitterIds)
      .in("status", ["pending", "accepted"]);
    busy = busyBookings || [];
  }
  const busyBySitter = {};
  for (const b of busy) {
    if (!busyBySitter[b.sitter_id]) busyBySitter[b.sitter_id] = [];
    for (const slot of b.booking_slots || []) busyBySitter[b.sitter_id].push(slot);
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Book pet sitting</h1>
      <p className="mt-2 text-[#7a5c4e]">Choose house sit or drop-in, pick times, then choose a sitter.</p>
      <BookingWizard
        customerId={profile.id}
        sitters={sitters || []}
        services={services || []}
        weekly={weekly || []}
        overrides={overrides || []}
        busyBySitter={busyBySitter}
        holidayDates={(holidays || []).map((h) => h.holiday_date)}
      />
    </div>
  );
}
