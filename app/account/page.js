import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export const metadata = { title: "My account | Paw Sitter" };

function hoursUntilUTC(startsAtISO) {
  if (!startsAtISO) return null;
  const now = Date.now();
  const start = new Date(startsAtISO).getTime();
  return (start - now) / (1000 * 60 * 60);
}

export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account");
  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, service_type, status, payment_status, payment_method, estimated_total, created_at, sitters(display_name), booking_slots(starts_at)")
    .eq("customer_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">My account</h1>
      <p className="mt-2 text-[#7a5c4e]">
        Signed in as <strong>{profile.email}</strong> - role:{" "}
        <span className="font-semibold text-[#c45c26]">{profile.role}</span>
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/booking" className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white">New booking</Link>
        {(profile.role === "sitter" || profile.role === "admin") && (
          <Link href="/sitter/dashboard" className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">Sitter dashboard</Link>
        )}
        {profile.role === "admin" && (
          <Link href="/admin/sitters" className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">Admin sitters</Link>
        )}
      </div>
      <h2 className="mt-10 text-xl font-semibold">Your bookings</h2>
      <ul className="mt-4 space-y-3">
        {(bookings || []).length === 0 ? (
          <li className="text-sm text-[#7a5c4e]">No bookings yet.</li>
        ) : (
          bookings.map((b) => {
            const firstSlot = (b.booking_slots || [])[0];
            const startsAtISO = firstSlot?.starts_at;
            const hoursUntilStart = hoursUntilUTC(startsAtISO);
            const showPay = b.status === "accepted" && b.payment_status !== "authorized" && b.payment_status !== "paid";
            const canPay = hoursUntilStart === null || hoursUntilStart >= 48;
            return (
              <li key={b.id} className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 px-4 py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">
                    {b.service_type === "house_sit" ? "House sit" : "Drop-in"} - {b.sitters?.display_name || "Sitter"}
                  </span>
                  <span className="rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs capitalize text-[#c45c26]">{b.status}</span>
                </div>
                <p className="mt-1 text-[#7a5c4e]">
                  Est. ${Number(b.estimated_total || 0).toFixed(2)} • Payment: <span className="font-medium capitalize">{b.payment_status || "pending"}</span>
                </p>
                {startsAtISO && (
                  <p className="mt-1 text-xs text-[#7a5c4e]">Starts: {new Date(startsAtISO).toLocaleString()}</p>
                )}
                {showPay && (
                  <div className="mt-2">
                    {!canPay ? (
                      <p className="text-xs text-red-600">Payment must be made at least 48 hours before the booking starts.</p>
                    ) : (
                      <button
                        onClick={async () => {
                          const res = await fetch("/api/booking/pay", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ booking_id: b.id }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Could not start payment");
                          window.location.href = data.url;
                        }}
                        className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white"
                      >
                        Pay now
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
