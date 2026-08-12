"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPES } from "@/lib/booking";
import LocationPicker from "@/components/LocationPicker";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SitterDashboardClient({ sitter }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    display_name: sitter.display_name || "",
    bio: sitter.bio || "",
    phone: sitter.phone || "",
    service_city: sitter.service_city || "",
    service_country: sitter.service_country || "Canada",
    location_id: sitter.location_id || "",
    timezone: sitter.timezone || "",
    lat: sitter.lat,
    lng: sitter.lng,
  });

  const [services, setServices] = useState(() => {
    const map = {};
    for (const s of sitter.sitter_services || []) map[s.service_type] = s;
    return Object.keys(SERVICE_TYPES).map((type) => {
      const row = map[type];
      return {
        service_type: type,
        enabled: row ? !!row.enabled : type === "drop_in",
        rate_regular: row?.rate_regular ?? 25,
        rate_holiday: row?.rate_holiday ?? 35,
        radius_km: row?.radius_km != null ? Number(row.radius_km) : 15,
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

  async function saveAll() {
    setSaving(true);
    setError("");
    setOk("");
    if (!profile.location_id || profile.lat == null) {
      setError("Please select your base city from the list (needed for service area matching).");
      setSaving(false);
      return;
    }
    const supabase = createClient();
    try {
      const { error: pErr } = await supabase
        .from("sitters")
        .update({
          display_name: profile.display_name,
          bio: profile.bio,
          phone: profile.phone || null,
          service_city: profile.service_city,
          service_country: profile.service_country,
          location_id: profile.location_id,
          timezone: profile.timezone,
          lat: profile.lat,
          lng: profile.lng,
        })
        .eq("id", sitter.id);
      if (pErr) throw pErr;

      for (const svc of services) {
        const radius = Math.max(1, Number(svc.radius_km) || 15);
        const payload = {
          sitter_id: sitter.id,
          service_type: svc.service_type,
          enabled: !!svc.enabled,
          rate_regular: Number(svc.rate_regular) || 0,
          rate_holiday: Number(svc.rate_holiday) || 0,
          radius_km: radius,
        };

        const { data: existing, error: findErr } = await supabase
          .from("sitter_services")
          .select("id")
          .eq("sitter_id", sitter.id)
          .eq("service_type", svc.service_type)
          .maybeSingle();
        if (findErr) throw findErr;

        let saved;
        if (existing?.id) {
          const { data, error: uErr } = await supabase
            .from("sitter_services")
            .update({
              enabled: payload.enabled,
              rate_regular: payload.rate_regular,
              rate_holiday: payload.rate_holiday,
              radius_km: payload.radius_km,
            })
            .eq("id", existing.id)
            .select("id, service_type, radius_km")
            .single();
          if (uErr) throw uErr;
          saved = data;
        } else {
          const { data, error: iErr } = await supabase
            .from("sitter_services")
            .insert(payload)
            .select("id, service_type, radius_km")
            .single();
          if (iErr) throw iErr;
          saved = data;
        }

        if (Number(saved?.radius_km) !== radius) {
          throw new Error(
            "Radius did not save for " +
              svc.service_type +
              ". Run SQL to add sitter_services.radius_km, then notify pgrst reload schema."
          );
        }
      }

      for (const day of weekly) {
        const { error: wErr } = await supabase.from("sitter_weekly_availability").upsert(
          {
            sitter_id: sitter.id,
            day_of_week: day.day_of_week,
            is_available: day.is_available,
            start_time: day.start_time,
            end_time: day.end_time,
          },
          { onConflict: "sitter_id,day_of_week" }
        );
        if (wErr) throw wErr;
      }

      setOk("Saved profile, service areas (km), and weekly hours.");
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
          <label className="text-sm">
            Display name
            <input value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" />
          </label>
          <label className="text-sm">
            Phone
            <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" />
          </label>
          <div className="sm:col-span-2">
            <LocationPicker
              valueId={profile.location_id}
              label="Base city (service area center)"
              onChange={(loc) => {
                if (!loc) {
                  setProfile((p) => ({ ...p, location_id: "", service_city: "", service_country: "", timezone: "", lat: null, lng: null }));
                  return;
                }
                setProfile((p) => ({
                  ...p,
                  location_id: loc.location_id,
                  service_city: loc.city,
                  service_country: loc.country,
                  timezone: loc.timezone,
                  lat: loc.lat,
                  lng: loc.lng,
                }));
              }}
            />
          </div>
          <label className="text-sm sm:col-span-2">
            Bio
            <textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Services, rates & area (km)</h2>
        <p className="mt-1 text-xs text-[#7a5c4e]">
          Radius is how far from your base city you offer each service. Customers outside that range will not see you.
        </p>
        <div className="mt-3 space-y-3">
          {services.map((svc, i) => (
            <div key={svc.service_type} className="grid gap-2 rounded-xl border border-[#e8d5c4] bg-white p-3 sm:grid-cols-5">
              <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                <input type="checkbox" checked={svc.enabled} onChange={(e) => setServices((list) => list.map((row, idx) => (idx === i ? { ...row, enabled: e.target.checked } : row)))} />
                {SERVICE_TYPES[svc.service_type]?.label}
              </label>
              <label className="text-xs">Regular $<input type="number" min="0" step="0.5" value={svc.rate_regular} onChange={(e) => setServices((list) => list.map((row, idx) => (idx === i ? { ...row, rate_regular: e.target.value } : row)))} className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1.5" /></label>
              <label className="text-xs">Holiday $<input type="number" min="0" step="0.5" value={svc.rate_holiday} onChange={(e) => setServices((list) => list.map((row, idx) => (idx === i ? { ...row, rate_holiday: e.target.value } : row)))} className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1.5" /></label>
              <label className="text-xs">Radius km<input type="number" min="1" max="500" step="1" value={svc.radius_km} onChange={(e) => setServices((list) => list.map((row, idx) => (idx === i ? { ...row, radius_km: e.target.value } : row)))} className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1.5" /></label>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Weekly default hours</h2>
        <p className="mt-1 text-xs text-[#7a5c4e]">Times are in your base city timezone ({profile.timezone || "not set"}).</p>
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
