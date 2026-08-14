"use client";

import { useMemo, useState } from "react";

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  const label = `${String(h).padStart(2, "0")}:${m}`;
  return { value: label, label };
});

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const weeks = [];
  let day = 1;
  let nextMonthDay = 1;

  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      if (w === 0 && d < startDay) {
        row.push({ day: daysInPrev - (startDay - d - 1), month: month - 1, current: false });
      } else if (day > daysInMonth) {
        row.push({ day: nextMonthDay++, month: month + 1, current: false });
      } else {
        row.push({ day: day++, month, current: true });
      }
    }
    weeks.push(row);
    if (day > daysInMonth && nextMonthDay > 1) break;
  }
  return weeks;
}

export default function MultiDateCalendar({ value = [], onChange, minDate = new Date() }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);

  const isSelected = (y, m, d) => value.some((dt) => {
    const x = new Date(dt);
    return x.getFullYear() === y && x.getMonth() === m && x.getDate() === d;
  });

  const isPast = (y, m, d) => {
    const dt = new Date(y, m, d);
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dt < now;
  };

  function toggleDate(y, m, d) {
    const dt = new Date(y, m, d).toISOString();
    if (isSelected(y, m, d)) {
      onChange(value.filter((x) => x !== dt));
    } else {
      onChange([...value, dt]);
    }
  }

  function saveDates() {
    onChange([...value]);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor((c) => ({ year: c.month === 0 ? c.year - 1 : c.year, month: c.month === 0 ? 11 : c.month - 1 }))}
          className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-sm"
        >
          ‹
        </button>
        <div className="text-sm font-semibold">
          {new Date(cursor.year, cursor.month).toLocaleString(undefined, { month: "long", year: "numeric" })}
        </div>
        <button
          type="button"
          onClick={() => setCursor((c) => ({ year: c.month === 11 ? c.year + 1 : c.year, month: c.month === 11 ? 0 : c.month + 1 }))}
          className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-sm"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#7a5c4e]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((cell, idx) => {
          const y = cell.month === cursor.month ? cursor.year : cell.month < 0 ? cursor.year - (cursor.month === 0 ? 1 : 0) : cursor.year + (cursor.month === 11 ? 1 : 0);
          const m = cell.month < 0 ? 11 : cell.month > 11 ? 0 : cell.month;
          const d = cell.day;
          const past = isPast(y, m, d);
          const selected = isSelected(y, m, d);
          return (
            <button
              key={idx}
              type="button"
              disabled={past}
              onClick={() => toggleDate(y, m, d)}
              className={
                "h-9 rounded-lg text-sm " +
                (past
                  ? "cursor-not-allowed bg-[#f5f5f5] text-[#c0c0c0]"
                  : selected
                  ? "bg-[#c45c26] text-white"
                  : cell.current
                  ? "bg-[#fff8f0] text-[#3b2a22]"
                  : "bg-white text-[#c0c0c0]")
              }
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-[#7a5c4e]">{value.length} day(s) selected</p>
        <button type="button" onClick={saveDates} className="rounded-full bg-[#c45c26] px-4 py-1.5 text-sm font-semibold text-white">Save dates</button>
      </div>
    </div>
  );
}
