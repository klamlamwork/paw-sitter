"use client";

import { useMemo, useState } from "react";
import { toHolidayKey } from "@/lib/holidays";

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export default function HolidayAdminClient({ initialHolidays = [] }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState(() =>
    Object.fromEntries((initialHolidays || []).map((h) => [toHolidayKey(h.holiday_date), h.name || "Holiday"]))
  );
  const [name, setName] = useState("Holiday");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const yearHolidays = useMemo(
    () => Object.entries(holidays).filter(([date]) => date.startsWith(String(year))).sort(([a], [b]) => a.localeCompare(b)),
    [holidays, year]
  );

  async function toggle(date) {
    setBusy(date);
    setError("");
    try {
      if (holidays[date]) {
        const res = await fetch("/api/admin/holidays", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not remove holiday");
        setHolidays((h) => {
          const next = { ...h };
          delete next[date];
          return next;
        });
      } else {
        const res = await fetch("/api/admin/holidays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not save holiday");
        setHolidays((h) => ({ ...h, [date]: name || "Holiday" }));
      }
    } catch (err) {
      setError(err.message || "Could not update holiday");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Year
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setYear((y) => y - 1)} className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-sm">‹</button>
            <span className="px-2 py-1 text-sm font-semibold">{year}</span>
            <button type="button" onClick={() => setYear((y) => y + 1)} className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-sm">›</button>
          </div>
        </label>
        <label className="text-sm">
          Holiday name for new days
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-56 rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" placeholder="Christmas, Canada Day…" />
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 12 }, (_, month) => (
          <section key={month} className="rounded-2xl border border-[#e8d5c4] bg-white p-3">
            <h2 className="text-sm font-semibold text-[#3b2a22]">{new Date(year, month, 1).toLocaleString(undefined, { month: "long" })}</h2>
            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] text-[#7a5c4e]">
              {["S", "M", "T", "W", "T", "F", "S"].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthMatrix(year, month).map((day, idx) => {
                if (!day) return <div key={idx} />;
                const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const on = !!holidays[date];
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={busy === date}
                    title={on ? holidays[date] : `Mark ${date} as ${name || "Holiday"}`}
                    onClick={() => toggle(date)}
                    className={"h-8 rounded-lg text-xs " + (on ? "bg-[#c45c26] font-semibold text-white" : "bg-[#fff8f0] text-[#3b2a22]")}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[#3b2a22]">{year} holidays</h2>
        {yearHolidays.length ? (
          <ul className="mt-3 space-y-1 text-sm">
            {yearHolidays.map(([date, label]) => (
              <li key={date} className="flex items-center justify-between rounded-xl border border-[#e8d5c4] bg-white px-3 py-2">
                <span>{date} · {label}</span>
                <button type="button" onClick={() => toggle(date)} className="text-xs font-semibold text-[#c45c26]">Remove</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#7a5c4e]">No holidays marked this year. Click a day to add one.</p>
        )}
      </div>
    </div>
  );
}
