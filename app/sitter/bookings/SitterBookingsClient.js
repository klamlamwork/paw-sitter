"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPES } from "@/lib/booking";
import BookingPriceBreakdown from "@/components/booking/BookingPriceBreakdown";
import ReviewBookingButton from "@/components/booking/ReviewBookingButton";
import { formatInTimezone, serviceLocationText, timezoneLabel } from "@/lib/bookingTime";

function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <ellipse cx="7" cy="8" rx="2.1" ry="2.6" transform="rotate(-18 7 8)" />
      <ellipse cx="12" cy="6.2" rx="2.1" ry="2.6" />
      <ellipse cx="17" cy="8" rx="2.1" ry="2.6" transform="rotate(18 17 8)" />
      <ellipse cx="5.6" cy="12.4" rx="1.8" ry="2.3" transform="rotate(-40 5.6 12.4)" />
      <path d="M12 11.2c-3.2 0-5.6 2.4-5.6 5.4 0 2.1 1.7 4.2 5.6 5.8 3.9-1.6 5.6-3.7 5.6-5.8 0-3-2.4-5.4-5.6-5.4z" />
    </svg>
  );
}

function PetDetail({ pet, onClose }) {
  if (!pet) return null;
  const reviews = pet.reviews || [];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-[#3b2a22]">{pet.name}</h3>
            <p className="text-sm text-[#7a5c4e]">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold">Close</button>
        </div>
        {pet.photo_url ? <img src={pet.photo_url} alt="" className="mt-4 h-40 w-40 rounded-2xl object-cover" /> : null}
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {pet.weight_lbs ? <div><dt className="text-xs text-[#7a5c4e]">Weight</dt><dd>{pet.weight_lbs} lbs</dd></div> : null}
          {pet.age_years || pet.age_months ? <div><dt className="text-xs text-[#7a5c4e]">Age</dt><dd>{pet.age_years ? `${pet.age_years} yr ` : ""}{pet.age_months ? `${pet.age_months} mo` : ""}</dd></div> : null}
          {pet.sex ? <div><dt className="text-xs text-[#7a5c4e]">Sex</dt><dd>{pet.sex}</dd></div> : null}
          {pet.is_spayed_neutered != null ? <div><dt className="text-xs text-[#7a5c4e]">Spayed/Neutered</dt><dd>{pet.is_spayed_neutered ? "Yes" : "No"}</dd></div> : null}
        </dl>
        {pet.medications?.length ? <p className="mt-3 text-sm"><span className="font-semibold">Medication:</span> {pet.medications.join(", ")}</p> : null}
        {pet.notes ? <p className="mt-3 whitespace-pre-wrap text-sm"><span className="font-semibold">Notes:</span> {pet.notes}</p> : null}
        <h4 className="mt-5 text-sm font-bold uppercase tracking-wide text-[#7a5c4e]">Sitter reviews</h4>
        {reviews.length ? (
          <ul className="mt-2 space-y-2">
            {reviews.map((row) => (
              <li key={row.id} className="rounded-xl border border-[#e8d5c4] bg-[#fff8f0] px-3 py-2 text-sm">
                <p className="text-xs font-semibold text-[#7a5c4e]">{row.sitters?.display_name || "Sitter"}{row.published_at ? ` · ${new Date(row.published_at).toLocaleDateString()}` : ""}</p>
                <p className="mt-1 whitespace-pre-wrap text-[#3b2a22]">{row.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#7a5c4e]">No published sitter reviews yet.</p>
        )}
      </div>
    </div>
  );
}

export default function SitterBookingsClient({ bookings: initial = [], sitterTimezone = "", sitterLocation = null }) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initial);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [openPetsId, setOpenPetsId] = useState("");
  const [detailPet, setDetailPet] = useState(null);
  const tz = timezoneLabel(sitterTimezone);

  async function setStatus(id, status) {
    setBusyId(id);
    setError("");
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from("bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (err) throw err;
      setBookings((list) => list.map((b) => (b.id === id ? { ...b, status } : b)));
      router.refresh();
    } catch (err) {
      setError(err.message || "Could not update booking.");
    } finally {
      setBusyId("");
    }
  }

  if (!bookings.length) {
    return <p className="mt-8 text-sm text-[#7a5c4e]">No booking requests yet.</p>;
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <p className="text-xs text-[#7a5c4e]">Times below are in your base timezone{tz ? <>: <strong>{tz}</strong></> : ""}.</p>
      {bookings.map((b) => {
        const label = SERVICE_TYPES[b.service_type]?.label || b.service_type || "Booking";
        const slots = b.booking_slots || [];
        const customer = b.profiles || b.customer || {};
        const pets = b.pets || [];
        const paid = b.payment_received || b.payment_status === "paid";
        const petsOpen = openPetsId === b.id;
        return (
          <article key={b.id} className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-[#3b2a22]">{label}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm text-[#7a5c4e]">{customer.full_name || "Customer"}</p>
                  <button
                    type="button"
                    onClick={() => setOpenPetsId(petsOpen ? "" : b.id)}
                    className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold " + (petsOpen ? "bg-[#3d2a14] text-white" : "bg-white text-[#5c4033] ring-1 ring-[#e8d5c4]")}
                    aria-expanded={petsOpen}
                    title="Paws to be serviced"
                  >
                    <PawIcon />
                    <span>Paws to be serviced{pets.length ? ` (${pets.length})` : ""}</span>
                  </button>
                </div>
                <p className="text-xs text-[#7a5c4e]">Service location: {serviceLocationText(b, b.sitters || sitterLocation)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase text-[#5c4033]">{b.status}</span>
                <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (paid ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900")}>
                  {paid ? "Paid" : `Payment: ${b.payment_method || "pending"}`}
                </span>
              </div>
            </div>

            {petsOpen ? (
              <div className="mt-3 rounded-2xl border border-[#e8d5c4] bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7a5c4e]">Paws to be serviced</p>
                {pets.length ? (
                  <ul className="mt-2 space-y-1">
                    {pets.map((pet) => (
                      <li key={pet.id}>
                        <button type="button" onClick={() => setDetailPet(pet)} className="text-sm font-semibold text-[#c45c26] hover:underline">{pet.name}</button>
                        <span className="ml-2 text-xs text-[#7a5c4e]">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[#7a5c4e]">No pets were attached to this booking.</p>
                )}
              </div>
            ) : null}

            {slots.length ? (
              <ul className="mt-3 space-y-2 text-sm text-[#5c4033]">
                {slots.map((slot) => (
                  <li key={slot.id || slot.starts_at} className="rounded-lg border border-[#e8d5c4]/80 bg-white px-3 py-2">
                    <span className="font-semibold">Your time:</span> {formatInTimezone(slot.starts_at, sitterTimezone)} → {formatInTimezone(slot.ends_at, sitterTimezone)}
                  </li>
                ))}
              </ul>
            ) : null}

            <BookingPriceBreakdown breakdown={b.price_breakdown} showKeep />
            {b.pet_notes ? <p className="mt-2 text-sm text-[#7a5c4e]">Pets: {b.pet_notes}</p> : null}
            {b.customer_message || b.customer_notes ? <p className="mt-1 text-sm text-[#7a5c4e]">Message: {b.customer_message || b.customer_notes}</p> : null}

            {b.status === "pending" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={busyId === b.id} onClick={() => setStatus(b.id, "accepted")} className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busyId === b.id ? "Saving…" : "Accept"}</button>
                <button type="button" disabled={busyId === b.id} onClick={() => setStatus(b.id, "declined")} className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-sm font-semibold text-[#5c4033] disabled:opacity-60">Decline</button>
              </div>
            ) : null}

            {!paid && b.status === "accepted" ? <p className="mt-4 text-xs text-[#7a5c4e]">Payment status is managed by the customer, Stripe, and administrators. Sitters cannot mark payments paid.</p> : null}

            <div className="mt-3">
              <ReviewBookingButton bookingId={b.id} label="Review pets" />
            </div>
          </article>
        );
      })}
      <PetDetail pet={detailPet} onClose={() => setDetailPet(null)} />
    </div>
  );
}
