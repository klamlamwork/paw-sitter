"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default function SitterDashboardClient({ sitter }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    display_name: sitter.display_name || "", bio: sitter.bio || "",
    service_city: sitter.service_city || "", service_country: sitter.service_country || "",
    profile_pic_url: sitter.profile_pic_url || "",
  });
  const initialServices = useMemo(() => {
    const map = {
      house_sit: { enabled: false, rate_regular: 0, rate_holiday: 0, id: null },
      drop_in: { enabled: false, rate_regular: 0, rate_holiday: 0, id: null },
    };
    for (const s of sitter.sitter_services || []) {
      map[s.service_type] = { enabled: s.enabled, rate_regular: s.rate_regular, rate_holiday: s.rate_holiday, id: s.id };
    }
    return map;
  }, [sitter]);
  const [svc, setSvc] = useState(initialServices);
  const initialWeekly = useMemo(() => {
    const byDay = {};
    for (let d = 0; d < 7; d++) {
      byDay[d] = { day_of_week: d, is_available: false, start_time: "09:00", end_time: "17:00", id: null };
    }
    for (const w of sitter.sitter_weekly_availability || []) {
      byDay[w.day_of_week] = {
        day_of_week: w.day_of_week, is_available: w.is_available,
        start_time: (w.start_time || "09:00").slice(0, 5), end_time: (w.end_time || "17:00").slice(0, 5), id: w.id,
      };
    }
    return byDay;
  }, [sitter]);
  const [weekly, setWeekly] = useState(initialWeekly);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [gallery, setGallery] = useState(sitter.sitter_gallery || []);
  async function saveAll(e) {
    e.preventDefault();
    setSaving(true); setError(""); setOk("");
    const supabase = createClient();
    try {
      const { error: pErr } = await supabase.from("sitters").update({
        display_name: profile.display_name, bio: profile.bio,
        service_city: profile.service_city, service_country: profile.service_country,
        profile_pic_url: profile.profile_pic_url || null,
      }).eq("id", sitter.id);
      if (pErr) throw pErr;
      for (const type of ["house_sit", "drop_in"]) {
        const row = svc[type];
        const payload = {
          sitter_id: sitter.id, service_type: type, enabled: !!row.enabled,
          rate_regular: Number(row.rate_regular) || 0, rate_holiday: Number(row.rate_holiday) || 0,
        };
        if (row.id) {
          const { error } = await supabase.from("sitter_services").update(payload).eq("id", row.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("sitter_services").insert(payload).select("id").single();
          if (error) throw error;
          setSvc((s) => ({ ...s, [type]: { ...s[type], id: data.id } }));
        }
      }
      for (let d = 0; d < 7; d++) {
        const w = weekly[d];
        const payload = {
          sitter_id: sitter.id, day_of_week: d, is_available: !!w.is_available,
          start_time: w.start_time, end_time: w.end_time,
        };
        if (w.id) {
          const { error } = await supabase.from("sitter_weekly_availability").update(payload).eq("id", w.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("sitter_weekly_availability").insert(payload).select("id").single();
          if (error) throw error;
          setWeekly((prev) => ({ ...prev, [d]: { ...prev[d], id: data.id } }));
        }
      }
      setOk("Saved.");
      router.refresh();
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }
  async function addGalleryImage(e) {
    e.preventDefault();
    if (!galleryUrl.trim()) return;
    const supabase = createClient();
    const { data, error: err } = await supabase.from("sitter_gallery").insert({
      sitter_id: sitter.id, image_url: galleryUrl.trim(), sort_order: gallery.length,
    }).select("*").single();
    if (err) { setError(err.message); return; }
    setGallery((g) => [...g, data]);
    setGalleryUrl("");
  }
  async function removeGallery(id) {
    const supabase = createClient();
    const { error: err } = await supabase.from("sitter_gallery").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setGallery((g) => g.filter((x) => x.id !== id));
  }
  return (
    <form onSubmit={saveAll} className="mt-8 space-y-8">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm text-green-700">{ok}</p> : null}
      <section className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold">Profile</h2>
        <label className="block text-sm">Display name<input className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} /></label>
        <label className="block text-sm">Bio<textarea className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" rows={4} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">City<input className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={profile.service_city} onChange={(e) => setProfile({ ...profile, service_city: e.target.value })} /></label>
          <label className="block text-sm">Country<input className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={profile.service_country} onChange={(e) => setProfile({ ...profile, service_country: e.target.value })} /></label>
        </div>
        <label className="block text-sm">Profile picture URL<input className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={profile.profile_pic_url} onChange={(e) => setProfile({ ...profile, profile_pic_url: e.target.value })} /></label>
      </section>
      <section className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold">Services and rates</h2>
        {["house_sit", "drop_in"].map((type) => (
          <div key={type} className="rounded-xl border border-[#e8d5c4] bg-white p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={svc[type].enabled} onChange={(e) => setSvc({ ...svc, [type]: { ...svc[type], enabled: e.target.checked } })} />
              {type === "house_sit" ? "House sit (per night)" : "Drop-in (per 30 min)"}
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs">Regular $<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1.5" value={svc[type].rate_regular} onChange={(e) => setSvc({ ...svc, [type]: { ...svc[type], rate_regular: e.target.value } })} /></label>
              <label className="text-xs">Holiday $<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1.5" value={svc[type].rate_holiday} onChange={(e) => setSvc({ ...svc, [type]: { ...svc[type], rate_holiday: e.target.value } })} /></label>
            </div>
          </div>
        ))}
      </section>
      <section className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold">Weekly availability</h2>
        {DAY_NAMES.map((name, d) => (
          <div key={d} className="grid grid-cols-[3rem_1fr_1fr_1fr] items-center gap-2 text-sm">
            <span className="font-medium">{name}</span>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={weekly[d].is_available} onChange={(e) => setWeekly({ ...weekly, [d]: { ...weekly[d], is_available: e.target.checked } })} /> Open
            </label>
            <input type="time" value={weekly[d].start_time} onChange={(e) => setWeekly({ ...weekly, [d]: { ...weekly[d], start_time: e.target.value } })} className="rounded-lg border border-[#e8d5c4] px-2 py-1" />
            <input type="time" value={weekly[d].end_time} onChange={(e) => setWeekly({ ...weekly, [d]: { ...weekly[d], end_time: e.target.value } })} className="rounded-lg border border-[#e8d5c4] px-2 py-1" />
          </div>
        ))}
      </section>
      <section className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold">Gallery</h2>
        <div className="flex flex-wrap gap-2">
          {gallery.map((g) => (
            <div key={g.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-[#e8d5c4]">
              <img src={g.image_url} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => removeGallery(g.id)} className="absolute right-0 top-0 bg-black/60 px-1 text-xs text-white">x</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={galleryUrl} onChange={(e) => setGalleryUrl(e.target.value)} placeholder="Image URL" className="flex-1 rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" />
          <button type="button" onClick={addGalleryImage} className="rounded-full border border-[#e8d5c4] bg-white px-4 text-sm font-semibold">Add</button>
        </div>
      </section>
      <button type="submit" disabled={saving} className="w-full rounded-full bg-[#c45c26] py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save changes"}</button>
    </form>
  );
}
