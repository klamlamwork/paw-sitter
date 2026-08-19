"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MED_OPTIONS = [
  { key: "Pill", label: "Pill" },
  { key: "Topical", label: "Topical" },
  { key: "Injection", label: "Injection" },
];

const EMPTY_FORM = {
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
};

function formFromPet(pet) {
  return {
    species: pet.species || "dog",
    name: pet.name || "",
    weight_lbs: pet.weight_lbs ?? "",
    age_years: pet.age_years ?? "",
    age_months: pet.age_months ?? "",
    sex: pet.sex || "",
    breed: pet.breed || "",
    is_spayed_neutered: pet.is_spayed_neutered === true ? "yes" : pet.is_spayed_neutered === false ? "no" : "",
    medications: Array.isArray(pet.medications) ? pet.medications : [],
    notes: pet.notes || "",
    photo_file: null,
  };
}

function PetForm({ form, setForm, onSave, saving, submitLabel }) {
  function toggleMed(key) {
    setForm((f) => {
      const has = (f.medications || []).includes(key);
      return { ...f, medications: has ? f.medications.filter((k) => k !== key) : [...(f.medications || []), key] };
    });
  }

  return (
    <div className="mt-2 grid gap-2">
      <label className="text-sm">
        <span className="font-medium">What type of pet?</span>
        <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}>
          <option value="dog">Dog</option>
          <option value="cat">Cat</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="font-medium">Name</span>
        <input className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label className="text-sm">
        <span className="font-medium">Weight (lbs)</span>
        <input type="number" step="0.1" className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.weight_lbs} onChange={(e) => setForm({ ...form, weight_lbs: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          <span className="font-medium">Age (Yr.)</span>
          <input type="number" min="0" className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.age_years} onChange={(e) => setForm({ ...form, age_years: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-medium">Age (Mo.)</span>
          <input type="number" min="0" max="11" className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.age_months} onChange={(e) => setForm({ ...form, age_months: e.target.value })} />
        </label>
      </div>
      <label className="text-sm">
        <span className="font-medium">Sex</span>
        <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="font-medium">Breed(s)</span>
        <input className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
      </label>
      <label className="text-sm">
        <span className="font-medium">Spayed/Neutered?</span>
        <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.is_spayed_neutered} onChange={(e) => setForm({ ...form, is_spayed_neutered: e.target.value })}>
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      <div>
        <span className="text-sm font-medium">Medication (select all that apply)</span>
        <div className="mt-1 grid gap-1">
          {MED_OPTIONS.map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={(form.medications || []).includes(m.key)} onChange={() => toggleMed(m.key)} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="text-sm">
        <span className="font-medium">Photo</span>
        <input type="file" accept="image/*" className="mt-1 w-full text-sm" onChange={(e) => setForm({ ...form, photo_file: e.target.files?.[0] || null })} />
      </label>
      <label className="text-sm">
        <span className="font-medium">Anything else a sitter should know?</span>
        <textarea className="mt-1 min-h-[80px] w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>
      <button type="button" onClick={onSave} disabled={saving || !form.name.trim()} className="mt-1 rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

export default function MyPawKidsClient({ initialPets = [], profileId }) {
  const [pets, setPets] = useState(initialPets);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function uploadPhoto(file, petId) {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${profileId}/${petId}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("pet-photos").upload(path, file, { upsert: true });
    if (uploadErr) throw uploadErr;
    return supabase.storage.from("pet-photos").getPublicUrl(path).data?.publicUrl || "";
  }

  function payloadFromForm(nextForm) {
    return {
      species: nextForm.species || "dog",
      name: nextForm.name.trim(),
      breed: nextForm.breed?.trim() || "",
      weight_lbs: nextForm.weight_lbs === "" ? null : Number(nextForm.weight_lbs),
      age_years: nextForm.age_years === "" ? 0 : Number(nextForm.age_years),
      age_months: nextForm.age_months === "" ? 0 : Number(nextForm.age_months),
      sex: nextForm.sex || null,
      is_spayed_neutered: nextForm.is_spayed_neutered === "yes" ? true : nextForm.is_spayed_neutered === "no" ? false : null,
      medications: nextForm.medications || [],
      notes: nextForm.notes?.trim() || "",
    };
  }

  async function addPet() {
    setError("");
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = { profile_id: profileId, ...payloadFromForm(form), photo_url: null };
      if (!payload.name) throw new Error("Pet name is required.");
      const { data, error: err } = await supabase.from("pets").insert(payload).select("id").single();
      if (err) throw err;
      let photoUrl = "";
      if (form.photo_file) {
        photoUrl = await uploadPhoto(form.photo_file, data.id);
        const { error: photoErr } = await supabase.from("pets").update({ photo_url: photoUrl, updated_at: new Date().toISOString() }).eq("id", data.id);
        if (photoErr) throw photoErr;
      }
      setPets((list) => [{ id: data.id, ...payload, photo_url: photoUrl }, ...list]);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.message || "Could not add pet");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(pet) {
    setError("");
    setEditingId(pet.id);
    setEditForm(formFromPet(pet));
  }

  async function saveEdit(pet) {
    setError("");
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = payloadFromForm(editForm);
      if (!payload.name) throw new Error("Pet name is required.");
      let photoUrl = pet.photo_url || "";
      if (editForm.photo_file) photoUrl = await uploadPhoto(editForm.photo_file, pet.id);
      const { error: err } = await supabase
        .from("pets")
        .update({ ...payload, photo_url: photoUrl || null, updated_at: new Date().toISOString() })
        .eq("id", pet.id)
        .eq("profile_id", profileId);
      if (err) throw err;
      setPets((list) => list.map((p) => (p.id === pet.id ? { ...p, ...payload, photo_url: photoUrl || null } : p)));
      setEditingId("");
      setEditForm(EMPTY_FORM);
    } catch (err) {
      setError(err.message || "Could not update pet");
    } finally {
      setSaving(false);
    }
  }

  async function removePet(id) {
    if (!confirm("Remove this pet from your profile?")) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("pets").delete().eq("id", id).eq("profile_id", profileId);
    if (err) { setError(err.message); return; }
    setPets((list) => list.filter((p) => p.id !== id));
    if (editingId === id) setEditingId("");
  }

  return (
    <div className="mt-3 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4">
        <h3 className="text-sm font-semibold text-[#3b2a22]">Add a pet</h3>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        <PetForm form={form} setForm={setForm} onSave={addPet} saving={saving} submitLabel="Add pet" />
      </div>

      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4">
        <h3 className="text-sm font-semibold text-[#3b2a22]">Your pets</h3>
        {pets.length === 0 ? (
          <p className="mt-2 text-sm text-[#7a5c4e]">No pets saved yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {pets.map((p) => (
              <li key={p.id} className="rounded-xl border border-[#f0e0d2] bg-white p-2 text-sm">
                <div className="flex items-start gap-3">
                  {p.photo_url ? <img src={p.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <div className="h-16 w-16 shrink-0 rounded-lg bg-[#faf3eb]" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.name} <span className="text-[#7a5c4e]">({p.species})</span></p>
                    {p.breed ? <p className="text-xs text-[#7a5c4e]">{p.breed}</p> : null}
                    {p.weight_lbs ? <p className="text-xs text-[#7a5c4e]">{p.weight_lbs} lbs</p> : null}
                    {p.age_years || p.age_months ? <p className="text-xs text-[#7a5c4e]">{p.age_years ? `${p.age_years} yr` : ""} {p.age_months ? `${p.age_months} mo` : ""}</p> : null}
                    {p.sex ? <p className="text-xs text-[#7a5c4e]">{p.sex}</p> : null}
                    {p.medications?.length ? <p className="mt-1 text-xs text-[#5c4033]">Meds: {p.medications.join(", ")}</p> : null}
                    {p.notes ? <p className="mt-1 text-xs text-[#5c4033]">{p.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => editingId === p.id ? setEditingId("") : startEdit(p)} className="rounded-full border border-[#c45c26] bg-white px-3 py-1 text-xs font-semibold text-[#c45c26]">{editingId === p.id ? "Close" : "Edit"}</button>
                    <button type="button" onClick={() => removePet(p.id)} className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-xs font-semibold">Remove</button>
                  </div>
                </div>
                {editingId === p.id ? (
                  <div className="mt-3 border-t border-[#e8d5c4] pt-3">
                    <h4 className="text-sm font-semibold text-[#3b2a22]">Edit {p.name}</h4>
                    <PetForm form={editForm} setForm={setEditForm} onSave={() => saveEdit(p)} saving={saving} submitLabel="Save changes" />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
