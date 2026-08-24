"use client";

import { useEffect, useState } from "react";

export default function AdminApplicationsClient() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const res = await fetch("/api/admin/sitter-applications");
    const data = await res.json();
    if (!res.ok) setError(data.error || "Could not load applications");
    else setRows(data.sitters || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id, action) {
    setBusy(id + action);
    setError("");
    try {
      const res = await fetch("/api/admin/sitter-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-[#3b2a22]">Applications</h2>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <ul className="mt-3 space-y-3">
        {rows.length === 0 ? (
          <li className="text-sm text-[#7a5c4e]">No pending or submitted applications.</li>
        ) : (
          rows.map((s) => (
            <li key={s.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.display_name}</p>
                  <p className="text-xs text-[#7a5c4e]">{s.invite_email}</p>
                  <p className="text-xs">{s.service_city} {s.service_country}</p>
                  <p className="text-xs">Phone: {s.phone_e164 || "—"} {s.phone_verified_at ? "(verified)" : "(not verified)"}</p>
                  <p className="text-xs capitalize">Status: {s.application_status}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => act(s.id, "approve")}
                    className="rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => act(s.id, "reject")}
                    className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-xs font-semibold disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
