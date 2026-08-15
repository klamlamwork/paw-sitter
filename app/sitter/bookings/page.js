import { redirect } from "next/navigation";
import Link from "next/link";
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
    .from("sitters")
    .select("id, timezone, service_city, service_country")
    .eq("profile_id", profile.id)
    .maybeSingle();

  let query = supabase
    .from("bookings")
    .select("*, booking_slots(*), profiles:customer_id(full_name, email, city, country, timezone), sitters(service_city, service_country, timezone)")
    .order("created_at", { ascending: false });

  if (sitter) {
    query = query.eq("sitter_id", sitter.id);
  } else if (profile.role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <p className="mt-3 text-[#7a5c4e]">No sitter profile linked.</p>
      </div>
    );
  }

  const { data: bookings } = await query;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#3b2a22]">Booking requests</h1>
          <p className="mt-2 text-sm text-[#7a5c4e]">
            Accept or decline requests. After accept, mark paid when payment is received.
            {sitter?.timezone ? <> Your timezone: <strong>{sitter.timezone}</strong>{sitter.service_city ? ` (${sitter.service_city})` : ""}.</> : null}
          </p>
        </div>
        <Link href="/sitter/calendar" className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-sm font-semibold text-[#5c4033]">
          Calendar
        </Link>
      </div>
      <SitterBookingsClient bookings={bookings || []} sitterTimezone={sitter?.timezone || null} sitterLocation={sitter || null} />
    </div>
  );
}
