"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPES } from "@/lib/booking";
import LocationPicker from "@/components/LocationPicker";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PET_SERVICES = new Set(["walking", "boarding"]);

export default function SitterDashboardClient({ sitter }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    display_name: sitter.display_name || "", bio: sitter.bio || "", phone: sitter.phone || "",
    service_city: sitter.service_city || "", service_country: sitter.service_country || "Canada",
    location_id: sitter.location_id || "", timezone: sitter.timezone || "", lat: sitter.lat, lng: sitter.lng,
  });

  const [services, setServices] = useState(() => {
    const map = {};
    for (const s of sitter.sitter_services || []) map[s.service_type] = s;
    return Object.keys(SERVICE_TYPES).map((type) => {
      const row = map[type];
      const raw = row?.radius_km;
      const unlimited = raw == null || (row && Number(raw) <= 0);
      return {
        service_type: type,
        enabled: row ? !!row.enabled : false,
        rate_regular: row?.rate_regular ?? (type === "boarding" || type === "house_sit" ? 45 : 25),
        rate_holiday: row?.rate_holiday ?? (type === "boarding" || type === "house_sit" ? 60 : 35),
        unlimited: row ? unlimited : false,
        radius_km: row && !unlimited ? Number(raw) : 50,
        accepts_dogs: row?.accepts_dogs !== false,
        accepts_cats: row?.accepts_cats !== false,
      };
    });
  });

  const [weekly, setWeekly] = useState(() => {
    const map = {};
    for (const w of sitter.sitter_weekly_availability || []) map[w.day_of_week] = w;
    return DAYS.map((_, i) => {
      const row = map[i];
      return {
        day_of_week: i,
        is_available: row ? !!row.is_available : i >= 1 && i <= 5,
        start_time: (row?.start_time || "09:00").slice(0, 5),
        end_time: (row?.end_time || "17:00").slice(0, 5),
      };
    });
  });

  function updateSvc(i, patch) {
    setServices((list) => list.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function saveAll() {
    setSaving(true); setError(""); setOk("");
    if (!profile.location_id || profile.lat == null) {
      setError("Please select your base city from the list.");
      setSaving(false); return;
    }
    for (const svc of services) {
      if (svc.enabled && PET_SERVICES.has(svc.service_type) && !svc.accepts_dogs && !svc.accepts_cats) {
        setError(SERVICE_TYPES[svc.service_type].label + ": select dog and/or cat.");
        setSaving(false); return;
      }
    }
    const supabase = createClient();
    try {
      const { error: pErr } = await supabase.from("sitters").update({
        display_name: profile.display_name, bio: profile.bio, phone: profile.phone || null,
        service_city: profile.service_city, service_country: profile.service_country,
        location_id: profile.location_id, timezone: profile.timezone, lat: profile.lat, lng: profile.lng,
      }).eq("id", sitter.id);
      if (pErr) throw pErr;

      for (const svc of services) {
        const radiusVal = svc.unlimited ? null : Math.max(1, Number(svc.radius_km) || 1);
        const payload = {
          sitter_id: sitter.id, service_type: svc.service_type, enabled: !!svc.enabled,
          rate_regular: Number(svc.rate_regular) || 0, rate_holiday: Number(svc.rate_holiday) || 0,
          radius_km: radiusVal,
          accepts_dogs: PET_SERVICES.has(svc.service_type) ? !!svc.accepts_dogs : true,
          accepts_cats: PET_SERVICES.has(svc.service_type) ? !!svc.accepts_cats : true,
        };
        const { data: existing, error: findErr } = await supabase.from("sitter_services").select("id")
          .eq("sitter_id", sitter.id).eq("service_type", svc.service_type).maybeSingle();
        if (findErr) throw findErr;
        if (existing?.id) {
          const { error: uErr } = await supabase.from("sitter_services").update({
            enabled: payload.enabled, rate_regular: payload.rate_regular, rate_holiday: payload.rate_holiday,
            radius_km: payload.radius_km, accepts_dogs: payload.accepts_dogs, accepts_cats: payload.accepts_cats,
          }).eq("id", existing.id);
          if (uErr) throw uErr;
        } else {
          const { error: iErr } = await supabase.from("sitter_services").insert(payload);
          if (iErr) throw iErr;
        }
      }

      for (const day of weekly) {
        const { error: wErr } = await supabase.from("sitter_weekly_availability").upsert({
          sitter_id: sitter.id, day_of_week: day.day_of_week, is_available: day.is_available,
          start_time: day.start_time, end_time: day.end_time,
        }, { onConflict: "sitter_id,day_of_week" });
        if (wErr) throw wErr;
      }
      setOk("Saved profile, services, and weekly hours.");
      router.refresh();
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

      <section className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Profile</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Display name<input value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" /></label>
          <label className="text-sm">Phone<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" /></label>
          <div className="sm:col-span-2">
            <LocationPicker valueId={profile.location_id} label="Base city (timezone / home base)" onChange={(loc) => {
              if (!loc) { setProfile((p) => ({ ...p, location_id: "", service_city: "", service_country: "", timezone: "", lat: null, lng: null })); return; }
              setProfile((p) => ({ ...p, location_id: loc.location_id, service_city: loc.city, service_country: loc.country, timezone: loc.timezone, lat: loc.lat, lng: loc.lng }));
            }} />
          </div>
          <label className="text-sm sm:col-span-2">Bio<textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Services, rates & area</h2>
        <p className="mt-1 text-xs text-[#7a5c4e]">Walking and boarding: choose dog and/or cat.</p>
        <div className="mt-3 space-y-3">
          {services.map((svc, i) => (
            <div key={svc.service_type} className="rounded-xl border border-[#e8d5c4] bg-white p-3">
              <div className="grid gap-2 sm:grid-cols-5">
                <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                  <input type="checkbox" checked={svc.enabled} onChange={(e) => updateSvc(i, { enabled: e.target.checked })} />
                  {SERVICE_TYPES[svc.service_type]?.label}
                  <span className="font-normal text-[#7a5c4e]">/{SERVICE_TYPES[svc.service_type]?.rateUnit}</span>
                </label>
                <label className="text-xs">Regular $<input type="number" min="0" step="0.5" value={svc.rate_regular} onChange={(e) => updateSvc(i, { rate_regular: e.target.value })} className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1.5" /></label>
                <label className="text-xs">Holiday $<input type="number" min="0" step="0.5" value={svc.rate_holiday} onChange={(e) => updateSvc(i, { rate_holiday: e.target.value })} className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1.5" /></label>
                <label className="text-xs">Radius km<input type="number" min="1" step="1" disabled={svc.unlimited} value={svc.radius_km} onChange={(e) => updateSvc(i, { radius_km: e.target.value, unlimited: false })} className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1.5 disabled:opacity-40" /></label>
              </div>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#5c4033]">
                  <input type="checkbox" checked={!!svc.unlimited} onChange={(e) => updateSvc(i, { unlimited: e.target.checked })} /> Anywhere
                </label>
                {PET_SERVICES.has(svc.service_type) ? (
                  <>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#5c4033]">
                      <input type="checkbox" checked={!!svc.accepts_dogs} onChange={(e) => updateSvc(i, { accepts_dogs: e.target.checked })} /> Dogs
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#5c4033]">
                      <input type="checkbox" checked={!!svc.accepts_cats} onChange={(e) => updateSvc(i, { accepts_cats: e.target.checked })} /> Cats
                    </label>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Weekly default hours</h2>
        <p className="mt-1 text-xs text-[#7a5c4e]">Timezone: {profile.timezone || "not set"}</p>
        <div className="mt-3 space-y-2">
          {weekly.map((day, i) => (
            <div key={day.day_of_week} className="grid grid-cols-2 gap-2 rounded-xl border border-[#e8d5c4] bg-white p-3 sm:grid-cols-4">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={day.is_available} onChange={(e) => setWeekly((list) => list.map((row, idx) => (idx === i ? { ...row, is_available: e.target.checked } : row)))} />
                {DAYS[day.day_of_week]}
              </label>
              <input type="time" disabled={!day.is_available} value={day.start_time} onChange={(e) => setWeekly((list) => list.map((row, idx) => (idx === i ? { ...row, start_time: e.target.value } : row)))} className="rounded-lg border border-[#e8d5c4] px-2 py-1.5 text-sm disabled:opacity-40" />
              <input type="time" disabled={!day.is_available} value={day.end_time} onChange={(e) => setWeekly((list) => list.map((row, idx) => (idx === i ? { ...row, end_time: e.target.value } : row)))} className="rounded-lg border border-[#e8d5c4] px-2 py-1.5 text-sm disabled:opacity-40" />
            </div>
          ))}
        </div>
      </section>

      <button type="button" disabled={saving} onClick={saveAll} className="w-full rounded-full bg-[#c45c26] py-3 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? "Saving..." : "Save dashboard"}
      </button>
    </div>
  );
}
