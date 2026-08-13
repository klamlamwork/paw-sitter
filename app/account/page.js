import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AccountLocationClient from "./AccountLocationClient";
import { SERVICE_TYPES } from "@/lib/booking";
import { formatInTimezone } from "@/lib/locations";

export const metadata = { title: "Account | Paw Sitter" };

export default async function AccountPage({ searchParams }) {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account");

  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, booking_slots(*), sitters(display_name, timezone)")
    .eq("customer_id", profile.id)
    .order("created_at", { ascending: false });

  const params = await searchParams;
  const booked = params?.booked;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Your account</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">{profile.email}</p>
      {booked ? (
        <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
          Booking request sent. The sitter will accept or decline soon.
        </p>
      ) : null}

      <AccountLocationClient profile={profile} />

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/booking" className="font-semibold text-[#c45c26] hover:underline">
          Book a sitter
        </Link>
        <Link href="/shop/orders" className="font-semibold text-[#c45c26] hover:underline">
          Shop orders
        </Link>
        <Link href="/account/shop" className="font-semibold text-[#c45c26] hover:underline">
          Shop portal
        </Link>
        {profile.role === "sitter" || profile.role === "admin" ? (
          <>
            <Link href="/sitter/dashboard" className="font-semibold text-[#c45c26] hover:underline">
              Sitter dashboard
            </Link>
            <Link href="/sitter/calendar" className="font-semibold text-[#c45c26] hover:underline">
              Calendar
            </Link>
            <Link href="/sitter/bookings" className="font-semibold text-[#c45c26] hover:underline">
              Booking requests
            </Link>
          </>
        ) : null}
      </div>

      <h2 className="mt-10 text-xl font-semibold text-[#3b2a22]">Your bookings</h2>
      {!bookings?.length ? (
        <p className="mt-4 text-sm text-[#7a5c4e]">No bookings yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {bookings.map((b) => {
            const tz = profile.timezone || b.sitters?.timezone;
            return (
              <li key={b.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4 text-sm">
                <div className="flex justify-between gap-2">
                  <strong>{SERVICE_TYPES[b.service_type]?.label || b.service_type}</strong>
                  <span className="text-xs font-semibold uppercase">{b.status}</span>
                </div>
                <p className="text-[#7a5c4e]">Sitter: {b.sitters?.display_name || "\u2014"}</p>
                <ul className="mt-2 space-y-1 text-[#5c4033]">
                  {(b.booking_slots || []).map((s) => (
                    <li key={s.id || s.starts_at}>
                      {formatInTimezone(s.starts_at, tz)} → {formatInTimezone(s.ends_at, tz)}
                      {tz ? <span className="text-xs text-[#7a5c4e]"> ({tz})</span> : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 font-medium text-[#c45c26]">
                  ${Number(b.estimated_total || 0).toFixed(2)} {b.currency || "CAD"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
