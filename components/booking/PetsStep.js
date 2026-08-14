"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PetsStep({ customerId, selectedPetIds = [], onChange }) {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", species: "dog", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("pets")
      .select("id, name, species, breed, weight_lbs, age_years, age_months, sex, is_spayed_neutered, medications, notes, photo_url")
      .eq("profile_id", customerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPets(data || []);
        setLoading(false);
        if (!selectedPetIds.length && data?.length) {
          onChange(data.map((p) => p.id));
        }
      });
  }, [customerId]);

  function togglePet(id) {
    onChange(selectedPetIds.includes(id) ? selectedPetIds.filter((x) => x !== id) : [...selectedPetIds, id]);
  }

  async function addQuickPet() {
    setError("");
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = { profile_id: customerId, name: form.name.trim() || "Pet", species: form.species, notes: form.notes?.trim() || "" };
      const { data, error: err } = await supabase.from("pets").insert(payload).select("id").single();
      if (err) throw err;
      const newPet = { id: data.id, ...payload };
      setPets((list) => [newPet, ...list]);
      onChange([...selectedPetIds, data.id]);
      setForm({ name: "", species: "dog", notes: "" });
    } catch (err) {
      setError(err.message || "Could not add pet");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-3">
        <h3 className="text-sm font-semibold text-[#3b2a22]">Your pets</h3>
        {loading ? <p className="mt-2 text-sm text-[#7a5c4e]">Loading…</p> : pets.length === 0 ? (
          <p className="mt-2 text-sm text-[#7a5c4e]">No pets saved yet. Add one below.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {pets.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#f0e0d2] bg-white p-2 text-sm">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedPetIds.includes(p.id)} onChange={() => togglePet(p.id)} />
                  <div>
                    <p className="font-semibold">{p.name} <span className="text-[#7a5c4e]">({p.species})</span></p>
                    {p.breed ? <p className="text-xs text-[#7a5c4e]">{p.breed}</p> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-3">
        <h3 className="text-sm font-semibold text-[#3b2a22]">Add a pet</h3>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        <div className="mt-2 grid gap-2">
          <input className="rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}>
            <option value="dog">Dog</option><option value="cat">Cat</option>
          </select>
          <textarea className="min-h-[80px] rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button onClick={addQuickPet} disabled={saving} className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Add pet"}</button>
        </div>
        <p className="mt-2 text-xs text-[#7a5c4e]">Tip: You can edit full details later in “My Paw Kids”.</p>
      </div>
    </div>
  );
}
