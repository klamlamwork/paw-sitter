"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { enabledServices, formatCityCountry, serviceLabel } from "@/lib/sitters";
import SitterRatingBadge from "@/components/SitterRatingBadge";

const ALL_SERVICES = ["house_sit", "drop_in", "walking", "boarding"];

export default function SittersIndexClient({ sitters = [], loadError = "" }) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [services, setServices] = useState([]);

  const cities = useMemo(() => {
    const set = new Set();
    for (const s of sitters || []) {
      const c = (s.service_city || "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sitters]);

  function toggleService(type) {
    setServices((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (sitters || []).filter((s) => {
      if (city && String(s.service_city || "").trim() !== city) return false;
      if (query) {
        const hay = `${s.display_name || ""} ${s.bio || ""} ${s.service_city || ""} ${s.service_country || ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (services.length) {
        const offered = new Set(enabledServices(s).map((x) => x.service_type));
        if (!services.some((t) => offered.has(t))) return false;
      }
      return true;
    });
  }, [sitters, q, city, services]);

  if (loadError) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Could not load sitters: {loadError}
        <span className="mt-1 block text-xs">If this mentions policy/permission, run sql/15-public-sitters-read.sql in Supabase.</span>
      </p>
    );
  }

  return (
    <div>
      <div className="sitters-toolbar flex flex-col gap-3 border border-[#e8d5c4] bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-[180px] flex-1 text-xs font-semibold text-[#7a5c4e]">
          Search
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or keyword" className="mt-1 w-full border border-[#e8d5c4] px-3 py-2 text-sm font-normal text-[#3b2a22]" />
        </label>
        <label className="block min-w-[160px] text-xs font-semibold text-[#7a5c4e]">
          City
          <select value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full border border-[#e8d5c4] bg-white px-3 py-2 text-sm font-normal text-[#3b2a22]">
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="w-full sm:w-auto">
          <p className="text-xs font-semibold text-[#7a5c4e]">Services (any)</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {ALL_SERVICES.map((type) => {
              const on = services.includes(type);
              return (
                <button key={type} type="button" aria-pressed={on} onClick={() => toggleService(type)} className={"px-3 py-1.5 text-xs font-semibold " + (on ? "bg-[#c45c26] text-white" : "border border-[#e8d5c4] bg-white text-[#5c4033]")}>
                  {serviceLabel(type)}
                </button>
              );
            })}
          </div>
        </div>
        {(q || city || services.length) ? (
          <button type="button" onClick={() => { setQ(""); setCity(""); setServices([]); }} className="text-sm font-semibold text-[#c45c26] hover:underline">Clear filters</button>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-[#7a5c4e]">{filtered.length} sitter{filtered.length === 1 ? "" : "s"}{services.length ? " matching selected services" : ""}</p>

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-[#7a5c4e]">No sitters match these filters.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const svcs = enabledServices(s);
            return (
              <Link key={s.id} href={`/sitters/${s.id}`} className="overflow-hidden rounded-2xl border border-[#e8d5c4] bg-white shadow-sm transition hover:border-[#c45c26]/50 hover:shadow-md">
                <div className="aspect-[16/9] w-full overflow-hidden bg-[#fff1e6]">
                  {s.profile_pic_url ? <img src={s.profile_pic_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-sm font-medium text-[#c4a484]">{(s.display_name || "?").slice(0, 1).toUpperCase()}</div>}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 flex-1 text-lg font-bold text-[#3b2a22]">{s.display_name}</h2>
                    <SitterRatingBadge avg={s.rating_avg} />
                  </div>
                  <p className="mt-1 text-xs font-medium text-[#7a5c4e]">{formatCityCountry(s)}</p>
                  {s.bio ? <p className="mt-3 line-clamp-3 text-sm text-[#5c4033]">{s.bio}</p> : <p className="mt-3 text-sm text-[#7a5c4e]">No bio yet.</p>}
                  {svcs.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {svcs.map((svc) => <span key={svc.service_type} className="border border-[#e8d5c4] bg-[#fff8f0] px-2 py-0.5 text-[11px] font-semibold text-[#5c4033]">{serviceLabel(svc.service_type)}</span>)}
                    </div>
                  ) : null}
                  <p className="mt-4 text-xs font-semibold text-[#c45c26]">View profile →</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
