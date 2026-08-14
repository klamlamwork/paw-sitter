"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MED_OPTIONS = [
  { key: "Pill", label: "Pill" },
  { key: "Topical", label: "Topical" },
  { key: "Injection", label: "Injection" },
];

export default function MyPawKidsClient({ initialPets = [], profileId }) {
  const [pets, setPets] = useState(initialPets);
  const [form, setForm] = useState({
    species: "dog",
    name: "",
    weight_lbs: "",
    age_years: "",
    age_months: "",
    sex: "",
    breed: "",
    is_spayed_neutered: "",
    medications: [],
    notes: "",
    photo_file: null,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function toggleMed(key) {
    setForm((f) => {
      const has = f.medications.includes(key);
      return { ...f, medications: has ? f.medications.filter((k) => k !== key) : [...f.medications, key] };
    });
  }

  async function uploadPhoto(file, petId) {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${profileId}/${petId}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("pet-photos").upload(path, file, { upsert: true });
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage.from("pet-photos").getPublicUrl(path);
    return urlData?.publicUrl || "";
  }

  async function addPet() {
    setError("");
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        profile_id: profileId,
        species: form.species || "dog",
        name: form.name.trim(),
        breed: form.breed?.trim() || "",
        weight_lbs: form.weight_lbs ? Number(form.weight_lbs) : null,
        age_years: form.age_years ? Number(form.age_years) : 0,
        age_months: form.age_months ? Number(form.age_months) : 0,
        sex: form.sex || null,
        is_spayed_neutered: form.is_spayed_neutered === "yes" ? true : form.is_spayed_neutered === "no" ? false : null,
        medications: form.medications || [],
        notes: form.notes?.trim() || "",
        photo_url: null,
      };
      if (!payload.name) throw new Error("Pet name is required.");
      const { data, error: err } = await supabase.from("pets").insert(payload).select("id").single();
      if (err) throw err;

      let photoUrl = "";
      if (form.photo_file) {
        setUploading(true);
        photoUrl = await uploadPhoto(form.photo_file, data.id);
        await supabase.from("pets").update({ photo_url: photoUrl, updated_at: new Date().toISOString() }).eq("id", data.id);
        setUploading(false);
      }

      setPets((list) => [{ id: data.id, ...payload, photo_url: photoUrl }, ...list]);
      setForm({ species: "dog", name: "", weight_lbs: "", age_years: "", age_months: "", sex: "", breed: "", is_spayed_neutered: "", medications: [], notes: "", photo_file: null });
    } catch (err) {
      setError(err.message || "Could not add pet");
    } finally {
      setSaving(false);
    }
  }

  async function removePet(id) {
    if (!confirm("Remove this pet from your profile?")) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("pets").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setPets((list) => list.filter((p) => p.id !== id));
  }

  return (
    <div className="mt-3 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4">
        <h3 className="text-sm font-semibold text-[#3b2a22]">Add a pet</h3>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        <div className="mt-2 grid gap-2">
          <label className="text-sm">
            <span className="font-medium">What type of pet?</span>
            <select
              className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              value={form.species}
              onChange={(e) => setForm({ ...form, species: e.target.value })}
            >
              <option value="dog">Dog</option>
              <option value="cat">Cat</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Name</span>
            <input
              className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Weight (lbs)</span>
            <input
              type="number"
              step="0.1"
              className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              placeholder="Weight (lbs)"
              value={form.weight_lbs}
              onChange={(e) => setForm({ ...form, weight_lbs: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="font-medium">Age (Yr.)</span>
              <input
                type="number"
                min="0"
                className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
                placeholder="Years"
                value={form.age_years}
                onChange={(e) => setForm({ ...form, age_years: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Age (Mo.)</span>
              <input
                type="number"
                min="0"
                max="11"
                className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
                placeholder="Months"
                value={form.age_months}
                onChange={(e) => setForm({ ...form, age_months: e.target.value })}
              />
            </label>
          </div>
          <label className="text-sm">
            <span className="font-medium">Sex</span>
            <select
              className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              value={form.sex}
              onChange={(e) => setForm({ ...form, sex: e.target.value })}
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Breed(s)</span>
            <input
              className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              placeholder="Breed(s)"
              value={form.breed}
              onChange={(e) => setForm({ ...form, breed: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Spayed/Neutered?</span>
            <select
              className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              value={form.is_spayed_neutered}
              onChange={(e) => setForm({ ...form, is_spayed_neutered: e.target.value })}
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <div>
            <span className="font-medium">Medication (select all that apply)</span>
            <div className="mt-1 grid gap-1">
              {MED_OPTIONS.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.medications.includes(m.key)}
                    onChange={() => toggleMed(m.key)}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="text-sm">
            <span className="font-medium">Photo</span>
            <input
              type="file"
              accept="image/*"
              className="mt-1 w-full text-sm"
              onChange={(e) => setForm({ ...form, photo_file: e.target.files?.[0] || null })}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Anything else a sitter should know?</span>
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <button
            onClick={addPet}
            disabled={saving || uploading || !form.name.trim()}
            className="mt-1 rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving || uploading ? "Saving…" : "Add pet"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4">
        <h3 className="text-sm font-semibold text-[#3b2a22]">Your pets</h3>
        {pets.length === 0 ? (
          <p className="mt-2 text-sm text-[#7a5c4e]">No pets saved yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {pets.map((p) => (
              <li key={p.id} className="flex items-start gap-3 rounded-xl border border-[#f0e0d2] bg-white p-2 text-sm">
                {p.photo_url ? (
                  <img src={p.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-[#faf3eb]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name} <span className="text-[#7a5c4e]">({p.species})</span></p>
                  {p.breed ? <p className="text-xs text-[#7a5c4e]">{p.breed}</p> : null}
                  {p.weight_lbs ? <p className="text-xs text-[#7a5c4e]">{p.weight_lbs} lbs</p> : null}
                  {p.age_years || p.age_months ? (
                    <p className="text-xs text-[#7a5c4e]">
                      {p.age_years ? `${p.age_years} yr` : ""} {p.age_months ? `${p.age_months} mo` : ""}
                    </p>
                  ) : null}
                  {p.sex ? <p className="text-xs text-[#7a5c4e]">{p.sex}</p> : null}
                  {p.medications?.length ? (
                    <p className="mt-1 text-xs text-[#5c4033]">Meds: {p.medications.join(", ")}</p>
                  ) : null}
                  {p.notes ? <p className="mt-1 text-xs text-[#5c4033]">{p.notes}</p> : null}
                </div>
                <button onClick={() => removePet(p.id)} className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-xs font-semibold">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
