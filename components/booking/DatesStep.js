"use client";

import { useState } from "react";
import MultiDateCalendar from "./MultiDateCalendar";

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  const label = `${String(h).padStart(2, "0")}:${m}`;
  return { value: label, label };
});

export default function DatesStep({ value = [], onChange, serviceType }) {
  const [selectedDates, setSelectedDates] = useState(value.map((v) => v.date));
  const [perDay, setPerDay] = useState(() => {
    const map = {};
    value.forEach((v) => { map[v.date] = v.times || []; });
    return map;
  });

  function addTime(date, time) {
    setPerDay((p) => {
      const list = p[date] || [];
      if (list.includes(time)) return p;
      return { ...p, [date]: [...list, time] };
    });
  }

  function removeTime(date, time) {
    setPerDay((p) => ({ ...p, [date]: (p[date] || []).filter((t) => t !== time) }));
  }

  function removeDay(date) {
    setSelectedDates((d) => d.filter((x) => x !== date));
    setPerDay((p) => { const copy = { ...p }; delete copy[date]; return copy; });
  }

  function save() {
    const payload = selectedDates.map((date) => ({ date, times: perDay[date] || [] }));
    onChange(payload);
  }

  const isHouseSit = serviceType === "house_sit";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-3">
        <MultiDateCalendar value={selectedDates} onChange={setSelectedDates} />
      </div>
      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-3">
        <h3 className="text-sm font-semibold text-[#3b2a22]">Times per day</h3>
        {selectedDates.length === 0 ? (
          <p className="mt-2 text-sm text-[#7a5c4e]">Select dates on the calendar first.</p>
        ) : (
          <div className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {selectedDates.map((date) => {
              const d = new Date(date);
              const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              const times = perDay[date] || [];
              return (
                <div key={date} className="rounded-xl border border-[#f0e0d2] bg-white p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{label}</p>
                    {!isHouseSit && (
                      <button onClick={() => removeDay(date)} className="text-xs text-[#c45c26]">Remove</button>
                    )}
                  </div>
                  {isHouseSit ? (
                    <p className="mt-1 text-xs text-[#7a5c4e]">House sit: overnight from this date to the next selected date.</p>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        className="rounded-lg border border-[#e8d5c4] bg-white px-2 py-1 text-xs"
                        onChange={(e) => {
                          if (!e.target.value) return;
                          addTime(date, e.target.value);
                          e.target.value = "";
                        }}
                        value=""
                      >
                        <option value="">Add time</option>
                        {TIME_SLOTS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-1">
                        {times.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs text-[#c45c26]">
                            {t}
                            <button onClick={() => removeTime(date, t)} className="text-[#c45c26]">×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={save} className="rounded-full bg-[#c45c26] px-4 py-1.5 text-sm font-semibold text-white">Save dates</button>
        </div>
      </div>
    </div>
  );
}
