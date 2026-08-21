"use client";

import { useEffect, useState } from "react";

const FRIENDLY = ["Adults", "Children", "Male Dogs", "Female Dogs", "Cats", "Small Animals", "Reactive / Keeps Distance"];
const DOG_TOYS = ["KONG / Rubber Chews", "Plushies with Squeakers", "Fetch Balls", "Tug Ropes", "Puzzle Toys"];
const CAT_TOYS = ["Feather Wands", "Crinkle Balls", "Catnip Mice", "Laser Pointers", "Interactive Electronic Toys"];
const ALLERGIES = ["Chicken", "Beef", "Dairy", "Flea Bites", "Pollen/Environmental", "None", "Other"];
const CONDITIONS = ["Arthritis", "Diabetes", "Kidney Disease", "Anxiety/Reactive", "Heart Condition", "None", "Other"];
const FRAGRANCES = ["Essential Oil Diffuser", "Scented Candles", "Plug-in Air Fresheners", "Incense", "Fabric Sprays", "None"];
const EVENTS = ["Vomiting", "Diarrhea", "Lethargy", "Vet Visit / Checkup", "Skin / Ear Issue", "Medication Administered", "Other"];

function Multi({ options, value = [], onChange }) {
  return (
    <div className="mt-1 grid gap-1">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.includes(opt)} onChange={() => onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt])} />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function Typeahead({ category, value, onPick, placeholder }) {
  const [q, setQ] = useState(value || "");
  const [rows, setRows] = useState([]);
  useEffect(() => { setQ(value || ""); }, [value]);
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/catalog?category=${encodeURIComponent(category)}&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setRows(d.products || []))
        .catch(() => setRows([]));
    }, 200);
    return () => clearTimeout(t);
  }, [category, q]);
  return (
    <div className="relative">
      <input className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={q} placeholder={placeholder} onChange={(e) => setQ(e.target.value)} />
      {rows.length ? (
        <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-[#e8d5c4] bg-white shadow">
          {rows.map((p) => (
            <li key={p.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-[#fff8f0]" onClick={() => { onPick(p); setQ(`${p.brand} ${p.name}`); setRows([]); }}>
                {p.brand} {p.name}{p.is_longevity_partner ? " · Longevity" : ""}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function PetProfileEditor({ pet }) {
  const [tab, setTab] = useState("diet");
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [episode, setEpisode] = useState({ event_type: "Vomiting", notes: "" });

  async function reload() {
    const res = await fetch(`/api/pets/profile?pet_id=${pet.id}`);
    const json = await res.json();
    if (res.ok) setData(json);
  }
  useEffect(() => { reload(); }, [pet.id]);

  async function save(module, payload) {
    setSaving(true); setMsg("");
    const res = await fetch("/api/pets/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet_id: pet.id, module, payload, update_reason: reason }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setMsg(json.error || "Could not save"); return; }
    const got = (json.award?.points || 0) + (json.award?.bonus || 0);
    setMsg(got ? `Saved. +${got} Paw Points` : json.award?.skipped === "cooldown" ? "Saved. Update points are on cooldown." : "Saved.");
    setReason("");
    reload();
  }

  async function addEpisode() {
    setSaving(true); setMsg("");
    const res = await fetch("/api/pets/episodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet_id: pet.id, ...episode }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setMsg(json.error || "Could not add episode"); return; }
    setMsg(json.award?.points ? `Logged. +${json.award.points} Paw Points` : "Logged.");
    setEpisode({ event_type: "Vomiting", notes: "" });
    reload();
  }

  if (!data) return <p className="mt-3 text-sm text-[#7a5c4e]">Loading profile…</p>;
  const p = data.progress || {};
  const diet = { ...(data.diet || {}) };
  const hygiene = { ...(data.hygiene || {}) };
  const medical = { ...(data.medical || {}) };
  const social = { ...(data.social || {}) };
  const toys = pet.species === "cat" ? CAT_TOYS : DOG_TOYS;

  return (
    <div className="mt-4 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4">
      <p className="text-xs text-[#7a5c4e]">Diet {p.diet || 0}% | Hygiene {p.hygiene || 0}% | Medical {p.medical || 0}% | Social {p.social || 0}% | Health {p.health || 0}%</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {["diet", "hygiene", "medical", "social", "health"].map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={"rounded-full px-3 py-1 text-xs font-semibold " + (tab === t ? "bg-[#c45c26] text-white" : "border border-[#e8d5c4] bg-white")}>{t}</button>
        ))}
      </div>
      {msg ? <p className="mt-2 text-xs text-green-800">{msg}</p> : null}

      {tab === "diet" ? (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="font-semibold">Current food</p>
          <Typeahead category="food" value={diet.food_product_name || diet.food_brand || ""} onPick={(prod) => { diet.food_product_id = prod.id; diet.food_brand = prod.brand; diet.food_product_name = prod.name; }} placeholder="Search food brand / product" />
          <button type="button" className="text-left text-xs font-semibold text-[#c45c26]" onClick={() => setTab("diet")}>Changed food or brand? Write a short review to earn +100 Paw Points</button>
          <label>Feeding style
            <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={diet.feeding_style || ""} onChange={(e) => { diet.feeding_style = e.target.value; setData({ ...data, diet }); }}>
              <option value="">Select</option>
              <option>Scheduled (e.g. 2x Daily)</option>
              <option>Free Feeding (Bowl left full)</option>
              <option>Combination</option>
            </select>
          </label>
          <label>Feeder type
            <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={diet.feeder_type || ""} onChange={(e) => { diet.feeder_type = e.target.value; setData({ ...data, diet }); }}>
              <option value="">Select</option>
              <option>Standard Stainless/Ceramic Bowl</option>
              <option>Slow Feeder Bowl</option>
              <option>Automatic/Electric Feeder</option>
              <option>Puzzle Feeder</option>
              <option>Lick Mat / Snuffle Mat</option>
            </select>
          </label>
          <label>Water source
            <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={diet.water_source || ""} onChange={(e) => { diet.water_source = e.target.value; setData({ ...data, diet }); }}>
              <option value="">Select</option>
              <option>Filtered Water Fountain</option>
              <option>Standard Water Bowl</option>
              <option>Gravity Water Dispenser</option>
              <option>Tap Water Bowl</option>
            </select>
          </label>
          <label>Portion / instructions<textarea className="mt-1 min-h-[60px] w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={diet.portion_notes || ""} onChange={(e) => { diet.portion_notes = e.target.value; setData({ ...data, diet }); }} /></label>
          <label>Update review ({reason.length}/25)<textarea className="mt-1 min-h-[60px] w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required for Switch & Earn (+100)" /></label>
          <button type="button" disabled={saving} onClick={() => save("diet", diet)} className="rounded-full bg-[#c45c26] px-4 py-2 text-xs font-semibold text-white">Save diet</button>
        </div>
      ) : null}

      {tab === "hygiene" ? (
        <div className="mt-3 grid gap-2 text-sm">
          {pet.species === "cat" ? (
            <>
              <p className="font-semibold">Litter</p>
              <Typeahead category="litter" value={hygiene.litter_name || ""} onPick={(prod) => { hygiene.litter_product_id = prod.id; hygiene.litter_name = `${prod.brand} ${prod.name}`; }} placeholder="Search litter" />
              <button type="button" className="text-left text-xs font-semibold text-[#c45c26]">Changed litter? Write a short review to earn +100 Paw Points</button>
              <label>Cleaning frequency<select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={hygiene.litter_cleaning || ""} onChange={(e) => { hygiene.litter_cleaning = e.target.value; setData({ ...data, hygiene }); }}><option value="">Select</option><option>Multiple Times Daily</option><option>Once Daily</option><option>Every 2 Days</option><option>Weekly</option></select></label>
            </>
          ) : null}
          <label>Floor cleaner<select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={hygiene.floor_cleaner || ""} onChange={(e) => { hygiene.floor_cleaner = e.target.value; setData({ ...data, hygiene }); }}><option value="">Select</option><option>Pet-Safe Enzymatic Cleaner</option><option>Vinegar/Water Solution</option><option>Standard Commercial Floor Cleaner</option><option>Steam Cleaner Only</option><option>Other</option></select></label>
          <p className="font-medium">Home fragrance</p>
          <Multi options={FRAGRANCES} value={hygiene.home_fragrance || []} onChange={(v) => { hygiene.home_fragrance = v; setData({ ...data, hygiene }); }} />
          <label>Bathing product<select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={hygiene.bathing_product || ""} onChange={(e) => { hygiene.bathing_product = e.target.value; setData({ ...data, hygiene }); }}><option value="">Select</option><option>Hypoallergenic Shampoo</option><option>Medicated/Antifungal Shampoo</option><option>Standard Pet Shampoo</option><option>Dry/Waterless Shampoo</option><option>Human Shampoo</option><option>Groomer Handled</option></select></label>
          <label>Nail routine<select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={hygiene.nail_routine || ""} onChange={(e) => { hygiene.nail_routine = e.target.value; setData({ ...data, hygiene }); }}><option value="">Select</option><option>Weekly (At Home)</option><option>Monthly (At Home)</option><option>Professional Groomer / Vet</option><option>Dremel / File</option><option>As Needed / Resists</option></select></label>
          <label>Hair brushing<select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={hygiene.brushing_routine || ""} onChange={(e) => { hygiene.brushing_routine = e.target.value; setData({ ...data, hygiene }); }}><option value="">Select</option><option>Daily</option><option>2-3 Times a Week</option><option>Weekly</option><option>Monthly / Rarely</option><option>Professional Groomer Only</option></select></label>
          <label>Update review ({reason.length}/25)<textarea className="mt-1 min-h-[60px] w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button type="button" disabled={saving} onClick={() => save("hygiene", hygiene)} className="rounded-full bg-[#c45c26] px-4 py-2 text-xs font-semibold text-white">Save hygiene</button>
        </div>
      ) : null}

      {tab === "medical" ? (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="font-medium">Allergies</p>
          <Multi options={ALLERGIES} value={medical.allergies || []} onChange={(v) => { medical.allergies = v; setData({ ...data, medical }); }} />
          <p className="font-medium">Conditions</p>
          <Multi options={CONDITIONS} value={medical.conditions || []} onChange={(v) => { medical.conditions = v; setData({ ...data, medical }); }} />
          <label>Insurance<select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={medical.insurance_company || ""} onChange={(e) => { medical.insurance_company = e.target.value; setData({ ...data, medical }); }}><option value="">Select</option><option>Trupanion</option><option>Spot</option><option>Petsecure</option><option>Fetch</option><option>CAA</option><option>Desjardins</option><option>Other</option><option>None</option></select></label>
          <label>Policy number<input className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={medical.policy_number || ""} onChange={(e) => { medical.policy_number = e.target.value; setData({ ...data, medical }); }} /></label>
          <label>Update notes<textarea className="mt-1 min-h-[60px] w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button type="button" disabled={saving} onClick={() => save("medical", medical)} className="rounded-full bg-[#c45c26] px-4 py-2 text-xs font-semibold text-white">Save medical</button>
        </div>
      ) : null}

      {tab === "social" ? (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="font-medium">Friendly with</p>
          <Multi options={FRIENDLY} value={social.friendly_with || []} onChange={(v) => { social.friendly_with = v; setData({ ...data, social }); }} />
          <p className="font-medium">Play style / toys</p>
          <Multi options={[...toys, "Others"]} value={social.play_toys || []} onChange={(v) => { social.play_toys = v; setData({ ...data, social }); }} />
          {(social.play_toys || []).includes("Others") ? <input className="rounded-xl border border-[#e8d5c4] px-3 py-2" placeholder="Custom toy" value={social.custom_toy || ""} onChange={(e) => { social.custom_toy = e.target.value; setData({ ...data, social }); }} /> : null}
          <button type="button" disabled={saving} onClick={() => save("social", social)} className="rounded-full bg-[#c45c26] px-4 py-2 text-xs font-semibold text-white">Save social</button>
        </div>
      ) : null}

      {tab === "health" ? (
        <div className="mt-3 grid gap-2 text-sm">
          <label>Event type<select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={episode.event_type} onChange={(e) => setEpisode({ ...episode, event_type: e.target.value })}>{EVENTS.map((e) => <option key={e}>{e}</option>)}</select></label>
          <label>Notes ({episode.notes.length}/10)<textarea className="mt-1 min-h-[60px] w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={episode.notes} onChange={(e) => setEpisode({ ...episode, notes: e.target.value })} /></label>
          <button type="button" disabled={saving} onClick={addEpisode} className="rounded-full bg-[#c45c26] px-4 py-2 text-xs font-semibold text-white">Log episode</button>
          <ul className="mt-2 space-y-1">
            {(data.episodes || []).map((ep) => <li key={ep.id} className="rounded-xl bg-white px-3 py-2 text-xs"><strong>{ep.event_type}</strong> · {new Date(ep.created_at).toLocaleString()}<br />{ep.notes}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
