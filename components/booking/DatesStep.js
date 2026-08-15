"use client";

import { useEffect, useState } from "react";
import DateRangePicker from "./DateRangePicker";
import MultiDateCalendar from "./MultiDateCalendar";

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  const label = `${String(h).padStart(2, "0")}:${m}`;
  return { value: label, label };
});

function isOvernight(serviceType) {
  return serviceType === "house_sit" || serviceType === "boarding";
}

export default function DatesStep({ value = [], onChange, serviceType }) {
  const overnight = isOvernight(serviceType);
  const [range, setRange] = useState(() => {
    if (overnight && value.length) {
      const dates = value.map((v) => new Date(v.date || v)).sort((a, b) => a - b);
      return { start: dates[0] || null, end: dates[dates.length - 1] || null };
    }
    return { start: null, end: null };
  });
  const [selectedDates, setSelectedDates] = useState(() => overnight ? [] : value.map((v) => v.date || v));
  const [perDay, setPerDay] = useState(() => {
    const map = {};
    (value || []).forEach((v) => { if (v?.date) map[v.date] = v.times || []; });
    return map;
  });
  const [startTime, setStartTime] = useState(value.startTime || "12:00");
  const [endTime, setEndTime] = useState(value.endTime || "12:00");

  useEffect(() => {
    if (!onChange) return;
    if (overnight) {
      if (!range.start || !range.end) {
        onChange(Object.assign([], { startTime, endTime }));
        return;
      }
      const payload = [];
      const cur = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
      const last = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate());
      while (cur <= last) {
        payload.push({ date: new Date(cur).toISOString() });
        cur.setDate(cur.getDate() + 1);
      }
      payload.startTime = startTime;
      payload.endTime = endTime;
      onChange(payload);
      return;
    }
    onChange(selectedDates.map((date) => ({ date, times: perDay[date] || [] })));
  }, [overnight, range, selectedDates, perDay, startTime, endTime]);

  function addTime(date, time) {
    if (!time) return;
    setPerDay((p) => {
      const list = p[date] || [];
      if (list.includes(time)) return p;
      return { ...p, [date]: [...list, time] };
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-3">
        {overnight ? (
          <>
            <DateRangePicker value={range} onChange={setRange} serviceType="house_sit" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-sm"><span className="font-medium">Start time</span>
                <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-2 py-1 text-sm" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                  {TIME_SLOTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-sm"><span className="font-medium">End time</span>
                <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-2 py-1 text-sm" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                  {TIME_SLOTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            </div>
          </>
        ) : (
          <MultiDateCalendar value={selectedDates} onChange={setSelectedDates} serviceType={serviceType} />
        )}
      </div>
      {!overnight && (
        <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-3">
          <h3 className="text-sm font-semibold text-[#3b2a22]">Times per day</h3>
          {selectedDates.length === 0 ? (
            <p className="mt-2 text-sm text-[#7a5c4e]">Select dates on the calendar first.</p>
          ) : (
            <div className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {selectedDates.map((date) => {
                const label = new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                const times = perDay[date] || [];
                return (
                  <div key={date} className="rounded-xl border border-[#f0e0d2] bg-white p-2">
                    <p className="text-sm font-semibold">{label}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select className="rounded-lg border border-[#e8d5c4] bg-white px-2 py-1 text-xs" value="" onChange={(e) => addTime(date, e.target.value)}>
                        <option value="">Add time</option>
                        {TIME_SLOTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <div className="flex flex-wrap gap-1">
                        {times.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs text-[#c45c26]">
                            {t}
                            <button type="button" onClick={() => setPerDay((p) => ({ ...p, [date]: (p[date] || []).filter((x) => x !== t) }))}>×</button>
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
