"use client";

function hoursUntilUTC(startsAtISO) {
  if (!startsAtISO) return null;
  const now = Date.now();
  const start = new Date(startsAtISO).getTime();
  return (start - now) / (1000 * 60 * 60);
}

export default function AccountBookingsClient({ bookings = [] }) {
  return (
    <ul className="mt-4 space-y-3">
      {bookings.length === 0 ? (
        <li className="text-sm text-[#7a5c4e]">No bookings yet.</li>
      ) : (
        bookings.map((b) => {
          const firstSlot = (b.booking_slots || [])[0];
          const startsAtISO = firstSlot?.starts_at;
          const hoursUntilStart = hoursUntilUTC(startsAtISO);
          const showPay = b.status === "accepted" && b.payment_status !== "authorized" && b.payment_status !== "paid";
          const canPay = hoursUntilStart === null || hoursUntilStart >= 48;
          const canCancel = b.status !== "canceled" && b.status !== "completed";
          const isLateCancel = hoursUntilStart !== null && hoursUntilStart < 48;
          const hasPayment = b.payment_status === "authorized" || b.payment_status === "paid";
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
              {canCancel && (
                <div className="mt-2">
                  {isLateCancel && hasPayment ? (
                    <p className="text-xs text-amber-700">Late cancel: 50% will be charged, remainder refunded.</p>
                  ) : null}
                  <button
                    onClick={async () => {
                      if (!confirm("Cancel this booking?")) return;
                      const res = await fetch("/api/booking/cancel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ booking_id: b.id }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Could not cancel");
                      window.location.reload();
                    }}
                    className="rounded-full border border-[#e8d5c4] bg-white px-4 py-1.5 text-xs font-semibold"
                  >
                    Cancel booking
                  </button>
                </div>
              )}
            </li>
          );
        })
      )}
    </ul>
  );
}
