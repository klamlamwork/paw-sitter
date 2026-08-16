"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { bookingServiceLine } from "@/lib/inbox";
import { formatInTimezone, serviceLocationText } from "@/lib/bookingTime";

function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
      <ellipse cx="7" cy="8" rx="2.1" ry="2.6" transform="rotate(-18 7 8)" />
      <ellipse cx="12" cy="6.2" rx="2.1" ry="2.6" />
      <ellipse cx="17" cy="8" rx="2.1" ry="2.6" transform="rotate(18 17 8)" />
      <ellipse cx="5.6" cy="12.4" rx="1.8" ry="2.3" transform="rotate(-40 5.6 12.4)" />
      <path d="M12 11.2c-3.2 0-5.6 2.4-5.6 5.4 0 2.1 1.7 4.2 5.6 5.8 3.9-1.6 5.6-3.7 5.6-5.8 0-3-2.4-5.4-5.6-5.4z" />
    </svg>
  );
}

export default function InboxThread({
  conversationId,
  profileId,
  otherName,
  booking,
  initialMessages = [],
  pets = [],
  role,
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPets, setShowPets] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [detailPet, setDetailPet] = useState(null);
  const fileRef = useRef(null);
  const endRef = useRef(null);
  const slots = booking?.booking_slots || [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const t = setInterval(async () => {
      const res = await fetch(`/api/inbox/send?conversation_id=${conversationId}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.messages)) setMessages(data.messages);
    }, 5000);
    return () => clearInterval(t);
  }, [conversationId]);

  async function send(photoUrl) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, body, photo_url: photoUrl || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send");
      setMessages((list) => [...list, data.message]);
      setBody("");
    } catch (err) {
      setError(err.message || "Could not send");
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${profileId}/${conversationId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("inbox-photos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("inbox-photos").getPublicUrl(path);
      await send(data?.publicUrl || "");
    } catch (err) {
      setError(err.message || "Could not attach photo");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="rounded-3xl border border-[#e8d5c4] bg-white">
        <div className="border-b border-[#e8d5c4] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-[#3b2a22]">{otherName}</h1>
              <p className="text-sm text-[#7a5c4e]">{bookingServiceLine(booking)}</p>
            </div>
            <span className="rounded-full bg-[#fff8f0] px-3 py-1 text-xs font-semibold capitalize">{booking?.status || "pending"}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowPets((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold">
              <PawIcon /> Paws to be serviced{pets.length ? ` (${pets.length})` : ""}
            </button>
            <button type="button" onClick={() => setShowDetails((v) => !v)} className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold">Booking details</button>
          </div>
          {showPets ? (
            <div className="mt-3 rounded-2xl bg-[#fff8f0] p-3">
              {pets.length ? pets.map((pet) => (
                <button key={pet.id} type="button" onClick={() => setDetailPet(pet)} className="mr-3 text-sm font-semibold text-[#c45c26] hover:underline">{pet.name}</button>
              )) : <p className="text-sm text-[#7a5c4e]">No pets attached.</p>}
            </div>
          ) : null}
          {showDetails ? (
            <div className="mt-3 space-y-1 rounded-2xl bg-[#fff8f0] p-3 text-sm text-[#5c4033]">
              <p>Location: {serviceLocationText(booking, booking.sitters)}</p>
              <p>Estimate: ${Number(booking.estimated_total || 0).toFixed(2)}</p>
              {slots.map((s) => (
                <p key={s.id || s.starts_at}>{formatInTimezone(s.starts_at, booking.booked_timezone)}{s.ends_at ? ` → ${formatInTimezone(s.ends_at, booking.booked_timezone)}` : ""}</p>
              ))}
              {booking.customer_message ? <p>Request note: {booking.customer_message}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m) => {
            const mine = m.sender_id === profileId;
            return (
              <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                <div className={"max-w-[80%] rounded-2xl px-3 py-2 text-sm " + (mine ? "bg-[#c45c26] text-white" : "bg-[#fff8f0] text-[#3b2a22]")}>
                  {m.photo_url ? <img src={m.photo_url} alt="" className="mb-2 max-h-48 rounded-xl object-cover" /> : null}
                  {m.body ? <p className="whitespace-pre-wrap">{m.body}</p> : null}
                  <p className={"mt-1 text-[10px] " + (mine ? "text-white/70" : "text-[#7a5c4e]")}>{new Date(m.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form
          className="border-t border-[#e8d5c4] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send("");
          }}
        >
          {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
          <div className="flex items-end gap-2">
            <textarea className="min-h-[44px] flex-1 border border-[#e8d5c4] px-3 py-2 text-sm" placeholder={`Message ${otherName}`} value={body} onChange={(e) => setBody(e.target.value)} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border border-[#e8d5c4] px-3 py-2 text-xs font-semibold" disabled={busy}>Photo</button>
            <button type="submit" disabled={busy} className="rounded-full bg-[#c45c26] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy ? "…" : "Send"}</button>
          </div>
        </form>
      </div>

      {detailPet ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setDetailPet(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><h3 className="text-lg font-bold">{detailPet.name}</h3><button type="button" onClick={() => setDetailPet(null)} className="text-xs font-semibold">Close</button></div>
            <p className="text-sm text-[#7a5c4e]">{detailPet.species}{detailPet.breed ? ` · ${detailPet.breed}` : ""}</p>
            {detailPet.photo_url ? <img src={detailPet.photo_url} alt="" className="mt-3 h-36 w-36 rounded-2xl object-cover" /> : null}
            {detailPet.notes ? <p className="mt-3 text-sm">{detailPet.notes}</p> : null}
            {(detailPet.reviews || []).map((r) => <p key={r.id} className="mt-2 rounded-xl bg-[#fff8f0] p-2 text-sm">{r.body}</p>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
