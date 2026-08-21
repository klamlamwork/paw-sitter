"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PetProfileEditor from "./PetProfileEditor";

const MED_OPTIONS = [
  { key: "None", label: "None" },
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
  birthday_year: "",
  birthday_month: "",
  birthday_day: "",
  sex: "",
  breed: "",
  is_spayed_neutered: "",
  medications: [],
  notes: "",
  photo_file: null,
  microchipped: "",
  microchip_number: "",
  vet_clinic: "",
};

function ageLabel(p) {
  const year = Number(p.birthday_year || 0);
  if (year) {
    const now = new Date();
    let months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - (Number(p.birthday_month) || 1));
    if (months < 0) months = 0;
    return `${Math.floor(months / 12)} yr ${months % 12} mo`;
  }
  if (p.age_years || p.age_months) return `${p.age_years ? `${p.age_years} yr` : ""} ${p.age_months ? `${p.age_months} mo` : ""}`.trim();
  return "";
}

function formFromPet(pet) {
  return {
    species: pet.species || "dog",
    name: pet.name || "",
    weight_lbs: pet.weight_lbs ?? "",
    age_years: pet.age_years ?? "",
    age_months: pet.age_months ?? "",
    birthday_year: pet.birthday_year ?? "",
    birthday_month: pet.birthday_month ?? "",
    birthday_day: pet.birthday_day ?? "",
    sex: pet.sex || "",
    breed: pet.breed || "",
    is_spayed_neutered: pet.is_spayed_neutered === true ? "yes" : pet.is_spayed_neutered === false ? "no" : "",
    medications: Array.isArray(pet.medications) ? pet.medications : [],
    notes: pet.notes || "",
    photo_file: null,
    microchipped: pet.microchipped === true ? "yes" : pet.microchipped === false ? "no" : "",
    microchip_number: pet.microchip_number || "",
    vet_clinic: pet.vet_clinic || "",
  };
}

function PetForm({ form, setForm, onSave, saving, submitLabel, currentPhotoUrl = "", fileKey = "photo", awardMsg = "" }) {
  function toggleMed(key) {
    setForm((f) => {
      if (key === "None") return { ...f, medications: (f.medications || []).includes("None") ? [] : ["None"] };
      const withoutNone = (f.medications || []).filter((k) => k !== "None");
      const has = withoutNone.includes(key);
      return { ...f, medications: has ? withoutNone.filter((k) => k !== key) : [...withoutNone, key] };
    });
  }
  const shownAge = ageLabel(form);

  return (
    <div className="mt-2 grid gap-2">
      <label className="text-sm">
        <span className="font-medium">What type of pet?</span>
        <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}>
          <option value="dog">Dog</option>
          <option value="cat">Cat</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="font-medium">Name</span>
        <input className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <p className="text-sm"><span className="font-medium">Age:</span> {shownAge || "Add a birthday year to show age"}</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-sm">Birthday year<input type="number" min="1990" max="2099" className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" value={form.birthday_year} onChange={(e) => setForm({ ...form, birthday_year: e.target.value })} /></label>
        <label className="text-sm">Month (optional)<input type="number" min="1" max="12" className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" value={form.birthday_month} onChange={(e) => setForm({ ...form, birthday_month: e.target.value })} /></label>
        <label className="text-sm">Day (optional)<input type="number" min="1" max="31" className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" value={form.birthday_day} onChange={(e) => setForm({ ...form, birthday_day: e.target.value })} /></label>
      </div>
      <label className="text-sm">
        <span className="font-medium">Weight (lbs)</span>
        <input type="number" step="0.1" className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.weight_lbs} onChange={(e) => setForm({ ...form, weight_lbs: e.target.value })} />
      </label>
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
      <label className="text-sm">
        <span className="font-medium">Microchipped?</span>
        <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.microchipped} onChange={(e) => setForm({ ...form, microchipped: e.target.value })}>
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      {form.microchipped === "yes" ? <label className="text-sm">Microchip number<input className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" value={form.microchip_number} onChange={(e) => setForm({ ...form, microchip_number: e.target.value })} /></label> : null}
      <label className="text-sm">Primary vet clinic<input className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" value={form.vet_clinic} onChange={(e) => setForm({ ...form, vet_clinic: e.target.value })} /></label>
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
        {currentPhotoUrl && !form.photo_file ? <img src={currentPhotoUrl} alt="" className="mt-1 h-20 w-20 rounded-lg object-cover" /> : null}
        {form.photo_file ? <p className="mt-1 text-xs text-[#7a5c4e]">Selected: {form.photo_file.name}</p> : null}
        <input key={fileKey} type="file" accept="image/*" className="mt-1 w-full text-sm" onChange={(e) => setForm((f) => ({ ...f, photo_file: e.target.files?.[0] || null }))} />
      </label>
      <label className="text-sm">
        <span className="font-medium">Anything else a sitter should know? (optional)</span>
        <textarea className="mt-1 min-h-[80px] w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>
      {awardMsg ? <p className="text-xs text-green-800">{awardMsg}</p> : null}
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
  const [photoKey, setPhotoKey] = useState(0);
  const [awardMsg, setAwardMsg] = useState("");

  async function uploadPhoto(file, petId) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("pet_id", petId);
    const res = await fetch("/api/pets/photo", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not upload photo");
    return data.photo_url || "";
  }

  function payloadFromForm(nextForm) {
    return {
      species: nextForm.species || "dog",
      name: nextForm.name.trim(),
      breed: nextForm.breed?.trim() || "",
      weight_lbs: nextForm.weight_lbs === "" ? null : Number(nextForm.weight_lbs),
      age_years: nextForm.age_years === "" ? 0 : Number(nextForm.age_years),
      age_months: nextForm.age_months === "" ? 0 : Number(nextForm.age_months),
      birthday_year: nextForm.birthday_year === "" ? null : Number(nextForm.birthday_year),
      birthday_month: nextForm.birthday_month === "" ? null : Number(nextForm.birthday_month),
      birthday_day: nextForm.birthday_day === "" ? null : Number(nextForm.birthday_day),
      sex: nextForm.sex || null,
      is_spayed_neutered: nextForm.is_spayed_neutered === "yes" ? true : nextForm.is_spayed_neutered === "no" ? false : null,
      medications: nextForm.medications || [],
      notes: nextForm.notes?.trim() || "",
      microchipped: nextForm.microchipped === "yes" ? true : nextForm.microchipped === "no" ? false : null,
      microchip_number: nextForm.microchip_number || "",
      vet_clinic: nextForm.vet_clinic || "",
    };
  }

  async function awardBasic(petId, payload, photoUrl) {
    const res = await fetch("/api/pets/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pet_id: petId,
        module: "basic",
        payload: { ...payload, photo_url: photoUrl || payload.photo_url || null },
      }),
    });
    const json = await res.json();
    const pts = (json.award?.points || 0) + (json.award?.bonus || 0);
    if (pts) setAwardMsg(`+${pts} Paw Points`);
    else setAwardMsg("");
    return json;
  }

  async function addPet() {
    setError("");
    setAwardMsg("");
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = { profile_id: profileId, ...payloadFromForm(form), photo_url: null };
      if (!payload.name) throw new Error("Pet name is required.");
      const { data, error: err } = await supabase.from("pets").insert(payload).select("id").single();
      if (err) throw err;
      let photoUrl = "";
      if (form.photo_file) photoUrl = await uploadPhoto(form.photo_file, data.id);
      await awardBasic(data.id, payload, photoUrl);
      setPets((list) => [{ id: data.id, ...payload, photo_url: photoUrl }, ...list]);
      setForm(EMPTY_FORM);
      setPhotoKey((n) => n + 1);
    } catch (err) {
      setError(err.message || "Could not add pet");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(pet) {
    setError("");
    setAwardMsg("");
    setEditingId(pet.id);
    setEditForm(formFromPet(pet));
  }

  async function saveEdit(pet) {
    setError("");
    setAwardMsg("");
    setSaving(true);
    try {
      const payload = payloadFromForm(editForm);
      if (!payload.name) throw new Error("Pet name is required.");
      let photoUrl = pet.photo_url || "";
      if (editForm.photo_file) photoUrl = await uploadPhoto(editForm.photo_file, pet.id);
      await awardBasic(pet.id, payload, photoUrl);
      setPets((list) => list.map((p) => (p.id === pet.id ? { ...p, ...payload, photo_url: photoUrl || null } : p)));
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
        <PetForm form={form} setForm={setForm} onSave={addPet} saving={saving} submitLabel="Add pet" fileKey={`add-${photoKey}`} awardMsg={editingId ? "" : awardMsg} />
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
                    {ageLabel(p) ? <p className="text-xs text-[#7a5c4e]">Age: {ageLabel(p)}</p> : null}
                    {p.breed ? <p className="text-xs text-[#7a5c4e]">{p.breed}</p> : null}
                    {p.weight_lbs ? <p className="text-xs text-[#7a5c4e]">{p.weight_lbs} lbs</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => editingId === p.id ? setEditingId("") : startEdit(p)} className="rounded-full border border-[#c45c26] bg-white px-3 py-1 text-xs font-semibold text-[#c45c26]">{editingId === p.id ? "Close" : "Edit"}</button>
                    <button type="button" onClick={() => removePet(p.id)} className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-xs font-semibold">Remove</button>
                  </div>
                </div>
                {editingId === p.id ? (
                  <div className="mt-3 border-t border-[#e8d5c4] pt-3">
                    <h4 className="text-sm font-semibold text-[#3b2a22]">Edit {p.name}</h4>
                    <PetForm form={editForm} setForm={setEditForm} onSave={() => saveEdit(p)} saving={saving} submitLabel="Save changes" currentPhotoUrl={p.photo_url || ""} fileKey={`edit-${p.id}-${photoKey}`} awardMsg={awardMsg} />
                    <PetProfileEditor pet={p} />
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
