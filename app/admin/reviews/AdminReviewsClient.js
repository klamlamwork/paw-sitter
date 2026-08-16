"use client";

import { useState } from "react";

function Card({ title, meta, body, status, onPublish, onReject, busy }) {
  return (
    <li className="rounded-2xl border border-[#e8d5c4] bg-white p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[#3b2a22]">{title}</p>
          <p className="text-xs text-[#7a5c4e]">{meta}</p>
        </div>
        <span className="rounded-full bg-[#fff8f0] px-2 py-0.5 text-xs capitalize">{status}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[#3b2a22]">{body}</p>
      {status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy} onClick={onPublish} className="rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Publish</button>
          <button type="button" disabled={busy} onClick={onReject} className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold disabled:opacity-60">Reject</button>
        </div>
      ) : null}
    </li>
  );
}

export default function AdminReviewsClient({ sitterReviews = [], petReviews = [] }) {
  const [sitters, setSitters] = useState(sitterReviews);
  const [pets, setPets] = useState(petReviews);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [cronMsg, setCronMsg] = useState("");

  async function update(kind, id, status) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update");
      const apply = (list) => list.map((row) => (row.id === id ? { ...row, status } : row));
      if (kind === "sitter") setSitters(apply);
      else setPets(apply);
    } catch (err) {
      setError(err.message || "Could not update");
    } finally {
      setBusyId("");
    }
  }

  async function sendInvites() {
    setCronMsg("");
    setError("");
    try {
      const res = await fetch("/api/admin/request-reviews", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send invites");
      setCronMsg(`Checked ${data.due || 0} finished bookings. Created ${data.created || 0} invite(s).`);
    } catch (err) {
      setError(err.message || "Could not send invites");
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <div>
        <button type="button" onClick={sendInvites} className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-sm font-semibold">
          Send review emails for finished paid bookings
        </button>
        {cronMsg ? <p className="mt-2 text-xs text-[#5c4033]">{cronMsg}</p> : null}
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-[#3b2a22]">Customer reviews of sitters</h2>
        <ul className="mt-3 space-y-3">
          {sitters.length === 0 ? <li className="text-sm text-[#7a5c4e]">None yet.</li> : sitters.map((row) => (
            <Card
              key={row.id}
              title={`${row.sitters?.display_name || "Sitter"} · ${row.rating} stars`}
              meta={new Date(row.created_at).toLocaleString()}
              body={row.body}
              status={row.status}
              busy={busyId === row.id}
              onPublish={() => update("sitter", row.id, "published")}
              onReject={() => update("sitter", row.id, "rejected")}
            />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#3b2a22]">Sitter reviews of pets</h2>
        <ul className="mt-3 space-y-3">
          {pets.length === 0 ? <li className="text-sm text-[#7a5c4e]">None yet.</li> : pets.map((row) => (
            <Card
              key={row.id}
              title={`${row.pets?.name || "Pet"} · by ${row.sitters?.display_name || "sitter"}`}
              meta={new Date(row.created_at).toLocaleString()}
              body={row.body}
              status={row.status}
              busy={busyId === row.id}
              onPublish={() => update("pet", row.id, "published")}
              onReject={() => update("pet", row.id, "rejected")}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
