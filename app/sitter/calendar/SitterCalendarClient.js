"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPES } from "@/lib/booking";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(y, m0, d) { return y + "-" + pad(m0 + 1) + "-" + pad(d); }
function daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
function buildMonthCells(y, m0) {
  const firstDow = new Date(y, m0, 1).getDay();
  const dim = daysInMonth(y, m0);
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function SitterCalendarClient({ sitterId, enabledServices, initialDayRows, initialYear }) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [dayRows, setDayRows] = useState(initialDayRows);
  const [selectedKey, setSelectedKey] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const rowsByDay = useMemo(() => {
    const map = {};
    for (const r of dayRows) {
      if (!map[r.day]) map[r.day] = [];
      map[r.day].push(r);
    }
    return map;
  }, [dayRows]);

  function daySummary(key) {
    const rows = rowsByDay[key];
    if (!rows || rows.length === 0) return "default";
    const on = rows.filter((r) => r.is_available).length;
    if (on === 0) return "off";
    if (on < enabledServices.length) return "partial";
    return "full";
  }

  function openDay(key) {
    setSelectedKey(key);
    setError("");
    setOk("");
    const rows = rowsByDay[key] || [];
    const next = {};
    for (const svc of enabledServices) {
      const existing = rows.find((r) => r.service_type === svc.service_type);
      if (existing) {
        next[svc.service_type] = {
          on: !!existing.is_available,
          start: (existing.start_time || "09:00").slice(0, 5),
          end: (existing.end_time || "17:00").slice(0, 5),
        };
      } else if (rows.length === 0) {
        next[svc.service_type] = { on: true, start: "09:00", end: "17:00" };
      } else {
        next[svc.service_type] = { on: false, start: "09:00", end: "17:00" };
      }
    }
    setForm(next);
  }

  function closeDay() {
    setSelectedKey(null);
    setForm({});
  }

  async function saveDay() {
    if (!selectedKey) return;
    setSaving(true); setError(""); setOk("");
    const supabase = createClient();
    try {
      const { error: delErr } = await supabase
        .from("sitter_day_availability")
        .delete()
        .eq("sitter_id", sitterId)
        .eq("day", selectedKey);
      if (delErr) throw delErr;

      const inserts = enabledServices.map((svc) => {
        const f = form[svc.service_type] || { on: false, start: "09:00", end: "17:00" };
        return {
          sitter_id: sitterId,
          day: selectedKey,
          service_type: svc.service_type,
          is_available: !!f.on,
          start_time: f.start || "09:00",
          end_time: f.end || "17:00",
        };
      });

      if (inserts.length) {
        const { data, error: insErr } = await supabase
          .from("sitter_day_availability")
          .insert(inserts)
          .select("*");
        if (insErr) throw insErr;
        setDayRows((prev) => {
          const rest = prev.filter((r) => !(r.sitter_id === sitterId && r.day === selectedKey));
          return [...rest, ...(data || [])];
        });
      }
      setOk("Saved " + selectedKey);
      router.refresh();
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearDayToDefault() {
    if (!selectedKey) return;
    setSaving(true); setError(""); setOk("");
    const supabase = createClient();
    try {
      const { error: delErr } = await supabase
        .from("sitter_day_availability")
        .delete()
        .eq("sitter_id", sitterId)
        .eq("day", selectedKey);
      if (delErr) throw delErr;
      setDayRows((prev) => prev.filter((r) => !(r.sitter_id === sitterId && r.day === selectedKey)));
      const next = {};
      for (const svc of enabledServices) {
        next[svc.service_type] = { on: true, start: "09:00", end: "17:00" };
      }
      setForm(next);
      setOk("Reset " + selectedKey + " to dashboard defaults");
      router.refresh();
    } catch (e) {
      setError(e.message || "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  if (!enabledServices.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[#e8d5c4] bg-white p-6 text-sm text-[#7a5c4e]">
        Enable at least one service on your dashboard first, then return here.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setYear((y) => y - 1)} className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-sm font-semibold">Prev year</button>
          <span className="min-w-[5rem] text-center text-xl font-bold text-[#3b2a22]">{year}</span>
          <button type="button" onClick={() => setYear((y) => y + 1)} className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-sm font-semibold">Next year</button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-[#7a5c4e]">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-[#e8d5c4] bg-white" /> Default</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-green-300 bg-green-100" /> All services</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-amber-300 bg-amber-100" /> Some services</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-red-300 bg-red-100" /> Unavailable</span>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="mb-4 text-sm text-green-700">{ok}</p> : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MONTHS.map((name, m0) => {
          const cells = buildMonthCells(year, m0);
          return (
            <div key={name} className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/80 p-3 shadow-sm">
              <h2 className="mb-2 text-center text-sm font-bold text-[#3b2a22]">{name} {year}</h2>
              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-[#7a5c4e]">
                {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((d, i) => {
                  if (d == null) return <div key={i} className="h-8" />;
                  const key = dateKey(year, m0, d);
                  const summary = daySummary(key);
                  const bg =
                    summary === "off" ? "bg-red-100 border-red-300" :
                    summary === "partial" ? "bg-amber-100 border-amber-300" :
                    summary === "full" ? "bg-green-100 border-green-300" :
                    "bg-white border-[#e8d5c4]";
                  const selected = selectedKey === key;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => openDay(key)}
                      className={"h-8 rounded border text-xs font-medium text-[#3b2a22] hover:ring-2 hover:ring-[#c45c26]/40 " + bg + (selected ? " ring-2 ring-[#c45c26]" : "")}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selectedKey ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#e8d5c4] bg-[#fff8f0] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-[#3b2a22]">{selectedKey}</h3>
                <p className="text-xs text-[#7a5c4e]">Choose services for this day. Uncheck = not bookable.</p>
              </div>
              <button type="button" onClick={closeDay} className="rounded-full border border-[#e8d5c4] bg-white px-2 py-1 text-sm">Close</button>
            </div>
            <div className="space-y-3">
              {enabledServices.map((svc) => {
                const f = form[svc.service_type] || { on: true, start: "09:00", end: "17:00" };
                const label = SERVICE_TYPES[svc.service_type]?.label || svc.service_type;
                return (
                  <div key={svc.service_type} className="rounded-2xl border border-[#e8d5c4] bg-white p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#3b2a22]">
                      <input
                        type="checkbox"
                        checked={!!f.on}
                        onChange={(e) => setForm((prev) => ({ ...prev, [svc.service_type]: { ...f, on: e.target.checked } }))}
                      />
                      {label}
                    </label>
                    {f.on ? (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <label>Start
                          <input type="time" value={f.start} onChange={(e) => setForm((prev) => ({ ...prev, [svc.service_type]: { ...f, start: e.target.value } }))} className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1.5" />
                        </label>
                        <label>End
                          <input type="time" value={f.end} onChange={(e) => setForm((prev) => ({ ...prev, [svc.service_type]: { ...f, end: e.target.value } }))} className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1.5" />
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" disabled={saving} onClick={saveDay} className="w-full rounded-full bg-[#c45c26] py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Saving..." : "Save this day"}
              </button>
              <button type="button" disabled={saving} onClick={clearDayToDefault} className="w-full rounded-full border border-[#e8d5c4] bg-white py-2.5 text-sm font-semibold text-[#5c4033] disabled:opacity-60">
                Reset to dashboard default
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
