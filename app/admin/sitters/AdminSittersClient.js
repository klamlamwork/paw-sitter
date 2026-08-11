"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
const emptyForm = {
  invite_email: "", display_name: "", bio: "",
  service_city: "Cambridge", service_country: "Canada", profile_pic_url: "",
  house_sit_enabled: true, house_sit_regular: "80", house_sit_holiday: "100",
  drop_in_enabled: true, drop_in_regular: "20", drop_in_holiday: "25",
};
const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2";
export default function AdminSittersClient({ initialSitters }) {
  const router = useRouter();
  const [sitters, setSitters] = useState(initialSitters);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(""); setOk("");
    const supabase = createClient();
    try {
      const { data: sitter, error: sErr } = await supabase.from("sitters").insert({
        invite_email: form.invite_email.trim().toLowerCase(),
        display_name: form.display_name.trim(),
        bio: form.bio,
        service_city: form.service_city.trim(),
        service_country: form.service_country.trim(),
        profile_pic_url: form.profile_pic_url || null,
        is_active: true,
      }).select("*").single();
      if (sErr) throw sErr;
      const serviceRows = [];
      if (form.house_sit_enabled) serviceRows.push({
        sitter_id: sitter.id, service_type: "house_sit", enabled: true,
        rate_regular: Number(form.house_sit_regular) || 0,
        rate_holiday: Number(form.house_sit_holiday) || 0,
      });
      if (form.drop_in_enabled) serviceRows.push({
        sitter_id: sitter.id, service_type: "drop_in", enabled: true,
        rate_regular: Number(form.drop_in_regular) || 0,
        rate_holiday: Number(form.drop_in_holiday) || 0,
      });
      if (serviceRows.length) {
        const { error: svcErr } = await supabase.from("sitter_services").insert(serviceRows);
        if (svcErr) throw svcErr;
      }
      const weekly = Array.from({ length: 7 }, (_, day_of_week) => ({
        sitter_id: sitter.id, day_of_week,
        start_time: "09:00", end_time: "17:00", is_available: true,
      }));
      const { error: wErr } = await supabase.from("sitter_weekly_availability").insert(weekly);
      if (wErr) throw wErr;
      setOk("Created " + sitter.display_name);
      setForm(emptyForm);
      setSitters((list) => [sitter, ...list]);
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setSaving(false);
    }
  }
  async function toggleActive(sitter) {
    const supabase = createClient();
    const { error: err } = await supabase.from("sitters").update({ is_active: !sitter.is_active }).eq("id", sitter.id);
    if (err) { setError(err.message); return; }
    setSitters((list) => list.map((s) => (s.id === sitter.id ? { ...s, is_active: !s.is_active } : s)));
  }
  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="text-lg font-semibold">Add sitter</h2>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {ok ? <p className="text-sm text-green-700">{ok}</p> : null}
        <label className="block text-sm">Invite email<input required type="email" className={inp} value={form.invite_email} onChange={(e) => setField("invite_email", e.target.value)} /></label>
        <label className="block text-sm">Display name<input required className={inp} value={form.display_name} onChange={(e) => setField("display_name", e.target.value)} /></label>
        <label className="block text-sm">Bio<textarea className={inp} rows={3} value={form.bio} onChange={(e) => setField("bio", e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">City<input className={inp} value={form.service_city} onChange={(e) => setField("service_city", e.target.value)} /></label>
          <label className="block text-sm">Country<input className={inp} value={form.service_country} onChange={(e) => setField("service_country", e.target.value)} /></label>
        </div>
        <label className="block text-sm">Profile pic URL<input className={inp} value={form.profile_pic_url} onChange={(e) => setField("profile_pic_url", e.target.value)} /></label>
        <fieldset className="rounded-xl border border-[#e8d5c4] p-3 text-sm">
          <legend className="px-1 font-semibold text-[#c45c26]">House sit / night</legend>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.house_sit_enabled} onChange={(e) => setField("house_sit_enabled", e.target.checked)} /> Enable</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label>Regular $<input type="number" className={inp} value={form.house_sit_regular} onChange={(e) => setField("house_sit_regular", e.target.value)} /></label>
            <label>Holiday $<input type="number" className={inp} value={form.house_sit_holiday} onChange={(e) => setField("house_sit_holiday", e.target.value)} /></label>
          </div>
        </fieldset>
        <fieldset className="rounded-xl border border-[#e8d5c4] p-3 text-sm">
          <legend className="px-1 font-semibold text-[#c45c26]">Drop-in / 30 min</legend>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.drop_in_enabled} onChange={(e) => setField("drop_in_enabled", e.target.checked)} /> Enable</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label>Regular $<input type="number" className={inp} value={form.drop_in_regular} onChange={(e) => setField("drop_in_regular", e.target.value)} /></label>
            <label>Holiday $<input type="number" className={inp} value={form.drop_in_holiday} onChange={(e) => setField("drop_in_holiday", e.target.value)} /></label>
          </div>
        </fieldset>
        <button type="submit" disabled={saving} className="w-full rounded-full bg-[#c45c26] py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Create sitter"}</button>
      </form>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Existing sitters</h2>
        <ul className="space-y-3">
          {sitters.length === 0 ? <li className="text-sm text-[#7a5c4e]">None yet.</li> : sitters.map((s) => (
            <li key={s.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4 text-sm">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.display_name}</p>
                  <p className="text-xs text-[#7a5c4e]">{s.invite_email}</p>
                  <p className="text-xs">Linked: {s.profile_id ? "yes" : "waiting for Google login"}</p>
                </div>
                <button type="button" onClick={() => toggleActive(s)} className={"rounded-full px-3 py-1 text-xs font-semibold " + (s.is_active ? "bg-green-100 text-green-800" : "bg-gray-100")}>{s.is_active ? "Active" : "Off"}</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
