"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function SitterBookingsClient({ initialBookings }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [error, setError] = useState("");
  const router = useRouter();
  async function setStatus(id, status) {
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (err) { setError(err.message); return; }
    setBookings((list) => list.map((b) => (b.id === id ? { ...b, status } : b)));
    router.refresh();
  }
  return (
    <div className="mt-6 space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {bookings.length === 0 ? (
        <p className="text-sm text-[#7a5c4e]">No requests yet.</p>
      ) : (
        bookings.map((b) => (
          <article key={b.id} className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                {b.service_type === "house_sit" ? "House sit" : "Drop-in"}
              </h2>
              <span className="rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs font-medium capitalize text-[#c45c26]">
                {b.status}
              </span>
            </div>
            <p className="mt-1 text-[#7a5c4e]">
              Est. ${Number(b.estimated_total || 0).toFixed(2)} - {new Date(b.created_at).toLocaleString()}
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {(b.booking_slots || []).map((s) => (
                <li key={s.id}>
                  {new Date(s.starts_at).toLocaleString()} to {new Date(s.ends_at).toLocaleString()} ({s.duration_minutes} min)
                </li>
              ))}
            </ul>
            {b.pet_notes ? <p className="mt-2"><strong>Pets:</strong> {b.pet_notes}</p> : null}
            {b.status === "pending" ? (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setStatus(b.id, "accepted")}
                  className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white">Accept</button>
                <button type="button" onClick={() => setStatus(b.id, "declined")}
                  className="rounded-full border border-[#e8d5c4] bg-white px-4 py-1.5 text-xs font-semibold">Decline</button>
              </div>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
