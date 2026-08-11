import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SitterCalendarClient from "./SitterCalendarClient";

export const metadata = { title: "Availability calendar | Paw Sitter" };

function toDateKeyFromIso(iso) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}

export default async function SitterCalendarPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/sitter/calendar");
  if (profile.role !== "sitter" && profile.role !== "admin") redirect("/account");

  const supabase = await createClient();
  const { data: sitter } = await supabase
    .from("sitters")
    .select("*, sitter_services(*)")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!sitter) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-[#3b2a22]">Calendar</h1>
        <p className="mt-3 text-[#7a5c4e]">
          No sitter profile linked to <strong>{profile.email}</strong>.
        </p>
      </div>
    );
  }

  const year = new Date().getFullYear();
  const from = year + "-01-01";
  const to = (year + 1) + "-12-31";

  const [{ data: dayRows }, { data: paidBookings }] = await Promise.all([
    supabase
      .from("sitter_day_availability")
      .select("*")
      .eq("sitter_id", sitter.id)
      .gte("day", from)
      .lte("day", to),
    supabase
      .from("bookings")
      .select("id, booking_slots(starts_at, ends_at)")
      .eq("sitter_id", sitter.id)
      .eq("status", "accepted")
      .eq("payment_received", true),
  ]);

  const bookedByDay = {};
  for (const b of paidBookings || []) {
    const seen = new Set();
    for (const slot of b.booking_slots || []) {
      const key = toDateKeyFromIso(slot.starts_at);
      if (seen.has(key)) continue;
      seen.add(key);
      bookedByDay[key] = (bookedByDay[key] || 0) + 1;
    }
  }

  const enabledServices = (sitter.sitter_services || []).filter((s) => s.enabled);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#3b2a22]">Availability calendar</h1>
          <p className="mt-2 text-sm text-[#7a5c4e]">
            Past months are hidden. Past days are greyed out. Paid bookings show as{" "}
            <strong>N booked</strong>. Defaults come from your{" "}
            <Link href="/sitter/dashboard" className="font-semibold text-[#c45c26] hover:underline">
              dashboard
            </Link>
            .
          </p>
        </div>
        <Link
          href="/sitter/bookings"
          className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-sm font-semibold text-[#5c4033]"
        >
          Booking requests
        </Link>
      </div>
      <SitterCalendarClient
        sitterId={sitter.id}
        enabledServices={enabledServices}
        initialDayRows={dayRows || []}
        initialYear={year}
        bookedByDay={bookedByDay}
      />
    </div>
  );
}
