"use client";

import { useState } from "react";
import DateRangePicker from "./DateRangePicker";

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  const label = `${String(h).padStart(2, "0")}:${m}`;
  return { value: label, label };
});

export default function DatesStep({ value = [], onChange, serviceType }) {
  const isHouseSit = serviceType === "house_sit";

  const [range, setRange] = useState(() => {
    if (isHouseSit && value.length >= 2) {
      const dates = value.map((v) => new Date(v.date)).sort((a, b) => a - b);
      return { start: dates[0], end: dates[dates.length - 1] };
    }
    return { start: null, end: null };
  });
  const [perDay, setPerDay] = useState(() => {
    const map = {};
    value.forEach((v) => { map[v.date] = v.times || []; });
    return map;
  });
  const [startTime, setStartTime] = useState(value.startTime || "12:00");
  const [endTime, setEndTime] = useState(value.endTime || "12:00");

  function save() {
    if (isHouseSit) {
      if (!range.start || !range.end || range.end < range.start) return;
      const payload = [];
      const cur = new Date(range.start);
      while (cur <= range.end) {
        payload.push({ date: cur.toISOString() });
        cur.setDate(cur.getDate() + 1);
      }
      payload.startTime = startTime;
      payload.endTime = endTime;
      onChange(payload);
    } else {
      const payload = Object.keys(perDay).map((date) => ({ date, times: perDay[date] || [] }));
      onChange(payload);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-3">
        <DateRangePicker value={range} onChange={setRange} serviceType={serviceType} />
        {isHouseSit && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="font-medium">Start time</span>
              <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-2 py-1 text-sm" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                {TIME_SLOTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">End time</span>
              <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-2 py-1 text-sm" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                {TIME_SLOTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={save} className="rounded-full bg-[#c45c26] px-4 py-1.5 text-sm font-semibold text-white">Save dates</button>
        </div>
      </div>
      {!isHouseSit && (
        <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-3">
          <h3 className="text-sm font-semibold text-[#3b2a22]">Times per day</h3>
          {Object.keys(perDay).length === 0 ? (
            <p className="mt-2 text-sm text-[#7a5c4e]">Select dates on the calendar first.</p>
          ) : (
            <div className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {Object.keys(perDay).map((date) => {
                const d = new Date(date);
                const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                const times = perDay[date] || [];
                return (
                  <div key={date} className="rounded-xl border border-[#f0e0d2] bg-white p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{label}</p>
                      <button onClick={() => {
                        setPerDay((p) => { const copy = { ...p }; delete copy[date]; return copy; });
                      }} className="text-xs text-[#c45c26]">Remove</button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        className="rounded-lg border border-[#e8d5c4] bg-white px-2 py-1 text-xs"
                        onChange={(e) => {
                          if (!e.target.value) return;
                          setPerDay((p) => {
                            const list = p[date] || [];
                            if (list.includes(e.target.value)) return p;
                            return { ...p, [date]: [...list, e.target.value] };
                          });
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
                            <button onClick={() => setPerDay((p) => ({ ...p, [date]: (p[date] || []).filter((x) => x !== t) }))} className="text-[#c45c26]">×¬</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
