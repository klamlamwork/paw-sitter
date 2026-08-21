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
          <input type="checkbox" checked={value.includes(opt)} onChange={() => {
            if (opt === "None") return onChange(value.includes("None") ? [] : ["None"]);
            const next = value.includes(opt) ? value.filter((v) => v !== opt) : [...value.filter((v) => v !== "None"), opt];
            onChange(next);
          }} />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function BrandProduct({ category, brand, productId, productName, onChange }) {
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  useEffect(() => {
    fetch("/api/catalog?category=" + encodeURIComponent(category))
      .then((r) => r.json())
      .then((d) => setBrands(d.brands || []))
      .catch(() => setBrands([]));
  }, [category]);
  useEffect(() => {
    if (!brand) { setProducts([]); return; }
    fetch("/api/catalog?category=" + encodeURIComponent(category) + "&brand=" + encodeURIComponent(brand))
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => setProducts([]));
  }, [category, brand]);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-sm">Brand
        <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={brand || ""} onChange={(e) => onChange({ brand: e.target.value, productId: "", productName: "" })}>
          <option value="">Select brand</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <label className="text-sm">Product
        <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={productId || ""} disabled={!brand} onChange={(e) => {
          const p = products.find((x) => x.id === e.target.value);
          onChange({ brand, productId: e.target.value, productName: p ? p.name : productName, longevity: !!p?.is_longevity_partner });
        }}>
          <option value="">{brand ? "Select product" : "Choose a brand first"}</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_longevity_partner ? " · Longevity" : ""}</option>)}
        </select>
      </label>
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
    const res = await fetch("/api/pets/profile?pet_id=" + pet.id);
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
    if (got) setMsg("Saved. +" + got + " Paw Points");
    else if (json.hint) setMsg("Saved. " + json.hint);
    else if (json.award?.skipped === "cooldown") setMsg("Saved. Update points are on cooldown.");
    else setMsg("Saved.");
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
    setMsg(json.award?.points ? "Logged. +" + json.award.points + " Paw Points" : "Logged.");
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
          <BrandProduct category="food" brand={diet.food_brand || ""} productId={diet.food_product_id || ""} productName={diet.food_product_name || ""} onChange={(v) => { diet.food_brand = v.brand; diet.food_product_id = v.productId || null; diet.food_product_name = v.productName || ""; setData({ ...data, diet }); }} />
          <p className="text-xs font-semibold text-[#c45c26]">Changed food or brand? Write a short review (25+ characters) to earn +100 Paw Points</p>
          <label>Feeding style<select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={diet.feeding_style || ""} onChange={(e) => { diet.feeding_style = e.target.value; setData({ ...data, diet }); }}><option value="">Select</option><option>Scheduled (e.g. 2x Daily)</option><option>Free Feeding (Bowl left full)</option><option>Combination</option></select></label>
          <label>Feeder type<select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={diet.feeder_type || ""} onChange={(e) => { diet.feeder_type = e.target.value; setData({ ...data, diet }); }}><option value="">Select</option><option>Standard Stainless/Ceramic Bowl</option><option>Slow Feeder Bowl</option><option>Automatic/Electric Feeder</option><option>Puzzle Feeder</option><option>Lick Mat / Snuffle Mat</option></select></label>
          <label>Water source<select className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={diet.water_source || ""} onChange={(e) => { diet.water_source = e.target.value; setData({ ...data, diet }); }}><option value="">Select</option><option>Filtered Water Fountain</option><option>Standard Water Bowl</option><option>Gravity Water Dispenser</option><option>Tap Water Bowl</option></select></label>
          <label>Portion / instructions<textarea className="mt-1 min-h-[60px] w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={diet.portion_notes || ""} onChange={(e) => { diet.portion_notes = e.target.value; setData({ ...data, diet }); }} /></label>
          <label>Update review ({reason.length}/25)<textarea className="mt-1 min-h-[60px] w-full rounded-xl border border-[#e8d5c4] px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required when changing brand/product" /></label>
          <button type="button" disabled={saving} onClick={() => save("diet", diet)} className="rounded-full bg-[#c45c26] px-4 py-2 text-xs font-semibold text-white">Save diet</button>
        </div>
      ) : null}

      {tab === "hygiene" ? (
        <div className="mt-3 grid gap-2 text-sm">
          {pet.species === "cat" ? (
            <>
              <BrandProduct category="litter" brand={hygiene.litter_brand || ""} productId={hygiene.litter_product_id || ""} productName={hygiene.litter_name || ""} onChange={(v) => { hygiene.litter_brand = v.brand; hygiene.litter_product_id = v.productId || null; hygiene.litter_name = v.productName ? (v.brand + " " + v.productName) : ""; setData({ ...data, hygiene }); }} />
              <p className="text-xs font-semibold text-[#c45c26]">Changed litter? Write a short review (25+ characters) to earn +100 Paw Points</p>
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
