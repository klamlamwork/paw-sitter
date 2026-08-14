"use client";

import { useMemo, useState } from "react";

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

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function DateRangePicker({ value = { start: null, end: null }, onChange, minDate = new Date(), serviceType }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);

  const isPast = (y, m, d) => {
    const dt = new Date(y, m, d);
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dt < now;
  };

  function handleClick(y, m, d) {
    if (serviceType !== "house_sit") return;
    const clicked = new Date(y, m, d);
    const { start, end } = value;
    if (!start || (start && end)) {
      onChange({ start: clicked, end: null });
    } else {
      if (clicked < start) {
        onChange({ start: clicked, end: start });
      } else {
        onChange({ start, end: clicked });
      }
    }
  }

  const isHouseSit = serviceType === "house_sit";
  const { start, end } = value;
  const valid = isHouseSit ? (start && end && end >= start) : true;

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
          const dt = new Date(y, m, d);
          let selected = false;
          let inRange = false;
          if (isHouseSit && start) {
            const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const e = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : s;
            const min = e < s ? e : s;
            const max = e < s ? s : e;
            inRange = dt >= min && dt <= max;
            selected = (dt.getTime() === s.getTime()) || (end && dt.getTime() === e.getTime());
          }
          return (
            <button
              key={idx}
              type="button"
              disabled={past}
              onClick={() => handleClick(y, m, d)}
              className={
                "h-9 rounded-lg text-sm " +
                (past
                  ? "cursor-not-allowed bg-[#f5f5f5] text-[#c0c0c0]"
                  : selected
                  ? "bg-[#c45c26] text-white"
                  : inRange
                  ? "bg-[#f3e0d0] text-[#c45c26]"
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
        <p className="text-xs text-[#7a5c4e]">
          {isHouseSit
            ? (start && end ? `${Math.round((end - start) / 86400000) + 1} nights selected` : "Select start date, then end date")
            : "Select dates"}
        </p>
        <button type="button" disabled={!valid} className="rounded-full bg-[#c45c26] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Save dates</button>
      </div>
    </div>
  );
}
