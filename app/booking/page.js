import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BookingWizardBridge from "@/components/booking/BookingWizardBridge";

export const metadata = { title: "Book a sitter | Paw Sitter" };

export default async function BookingPage({ searchParams }) {
  const sp = await searchParams;
  const preferredSitterId = typeof sp?.sitter === "string" ? sp.sitter.trim() : "";
  const nextPath = preferredSitterId
    ? `/booking?sitter=${encodeURIComponent(preferredSitterId)}`
    : "/booking";

  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  const supabase = await createClient();
  const [
    { data: sitters },
    { data: services },
    { data: weekly },
    { data: overrides },
    { data: holidays },
    { data: dayAvailability },
  ] = await Promise.all([
    supabase.from("sitters").select("*").eq("is_active", true).order("display_name"),
    supabase.from("sitter_services").select("*").eq("enabled", true),
    supabase.from("sitter_weekly_availability").select("*"),
    supabase.from("sitter_date_overrides").select("*"),
    supabase.from("holiday_dates").select("holiday_date"),
    supabase.from("sitter_day_availability").select("*"),
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

  const preferred =
    preferredSitterId && (sitters || []).find((s) => String(s.id) === String(preferredSitterId));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Book pet sitting</h1>
      <p className="mt-2 text-[#7a5c4e]">
        Choose your city, then service and times. Sitters are matched by service area (km) and
        availability.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-[#7a5c4e]">Loading booking…</p>}>
        <BookingWizardBridge
          customerId={profile.id}
          customerProfile={profile}
          sitters={sitters || []}
          services={services || []}
          weekly={weekly || []}
          overrides={overrides || []}
          busyBySitter={busyBySitter}
          dayAvailability={dayAvailability || []}
          holidayDates={(holidays || []).map((h) => h.holiday_date)}
          preferredSitterId={preferred ? String(preferred.id) : ""}
          preferredSitterName={preferred?.display_name || ""}
        />
      </Suspense>
    </div>
  );
}
