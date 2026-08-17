"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CA_PROVINCES = [
  { code: "CA-AB", label: "Alberta" },
  { code: "CA-BC", label: "British Columbia" },
  { code: "CA-MB", label: "Manitoba" },
  { code: "CA-NB", label: "New Brunswick" },
  { code: "CA-NL", label: "Newfoundland and Labrador" },
  { code: "CA-NS", label: "Nova Scotia" },
  { code: "CA-ON", label: "Ontario" },
  { code: "CA-PE", label: "Prince Edward Island" },
  { code: "CA-QC", label: "Quebec" },
  { code: "CA-SK", label: "Saskatchewan" },
  { code: "CA-NT", label: "Northwest Territories" },
  { code: "CA-NU", label: "Nunavut" },
  { code: "CA-YT", label: "Yukon" },
];

const US_STATES = [
  { code: "US-AL", label: "Alabama" }, { code: "US-AK", label: "Alaska" }, { code: "US-AZ", label: "Arizona" },
  { code: "US-AR", label: "Arkansas" }, { code: "US-CA", label: "California" }, { code: "US-CO", label: "Colorado" },
  { code: "US-CT", label: "Connecticut" }, { code: "US-DE", label: "Delaware" }, { code: "US-FL", label: "Florida" },
  { code: "US-GA", label: "Georgia" }, { code: "US-HI", label: "Hawaii" }, { code: "US-ID", label: "Idaho" },
  { code: "US-IL", label: "Illinois" }, { code: "US-IN", label: "Indiana" }, { code: "US-IA", label: "Iowa" },
  { code: "US-KS", label: "Kansas" }, { code: "US-KY", label: "Kentucky" }, { code: "US-LA", label: "Louisiana" },
  { code: "US-ME", label: "Maine" }, { code: "US-MD", label: "Maryland" }, { code: "US-MA", label: "Massachusetts" },
  { code: "US-MI", label: "Michigan" }, { code: "US-MN", label: "Minnesota" }, { code: "US-MS", label: "Mississippi" },
  { code: "US-MO", label: "Missouri" }, { code: "US-MT", label: "Montana" }, { code: "US-NE", label: "Nebraska" },
  { code: "US-NV", label: "Nevada" }, { code: "US-NH", label: "New Hampshire" }, { code: "US-NJ", label: "New Jersey" },
  { code: "US-NM", label: "New Mexico" }, { code: "US-NY", label: "New York" }, { code: "US-NC", label: "North Carolina" },
  { code: "US-ND", label: "North Dakota" }, { code: "US-OH", label: "Ohio" }, { code: "US-OK", label: "Oklahoma" },
  { code: "US-OR", label: "Oregon" }, { code: "US-PA", label: "Pennsylvania" }, { code: "US-RI", label: "Rhode Island" },
  { code: "US-SC", label: "South Carolina" }, { code: "US-SD", label: "South Dakota" }, { code: "US-TN", label: "Tennessee" },
  { code: "US-TX", label: "Texas" }, { code: "US-UT", label: "Utah" }, { code: "US-VT", label: "Vermont" },
  { code: "US-VA", label: "Virginia" }, { code: "US-WA", label: "Washington" }, { code: "US-WV", label: "West Virginia" },
  { code: "US-WI", label: "Wisconsin" }, { code: "US-WY", label: "Wyoming" },
];

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";
const smallInp = "mt-1 w-28 rounded-xl border border-[#e8d5c4] px-2 py-1 text-sm";

export default function ShippingSettingsForm({ shopId, initial }) {
  const [form, setForm] = useState(initial || {
    fulfillment_province: "CA-ON",
    allow_national: true,
    national_regions: [],
    ship_to_us: false,
    exclude_regions: [],

    standard_home_flat_cents: 0,
    standard_home_min_days: 3,
    standard_home_max_days: 7,
    standard_home_free_over_cents: null,

    standard_national_flat_cents: 0,
    standard_national_min_days: 5,
    standard_national_max_days: 10,
    standard_national_free_over_cents: null,

    standard_us_flat_cents: 0,
    standard_us_min_days: 7,
    standard_us_max_days: 14,
    standard_us_free_over_cents: null,

    express_enabled: false,
    express_rate_mode: "flat",
    express_surcharge_cents: 0,

    express_home_flat_cents: 0,
    express_home_min_days: 1,
    express_home_max_days: 3,
    express_home_free_over_cents: null,

    express_national_flat_cents: 0,
    express_national_min_days: 2,
    express_national_max_days: 5,
    express_national_free_over_cents: null,

    express_us_flat_cents: 0,
    express_us_min_days: 5,
    express_us_max_days: 10,
    express_us_free_over_cents: null,

    pickup_enabled: false,
    pickup_ready_hours: 24,
    pickup_home_flat_cents: 0,
    pickup_national_flat_cents: 0,
    pickup_us_flat_cents: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleRegion(listKey, code) {
    setForm((f) => {
      const arr = new Set(f[listKey]);
      if (arr.has(code)) arr.delete(code);
      else arr.add(code);
      return { ...f, [listKey]: [...arr] };
    });
  }

  function toggleAll(listKey, items, checked) {
    setForm((f) => ({ ...f, [listKey]: checked ? items.map((i) => i.code) : [] }));
  }

  async function save() {
    setBusy(true);
    setError("");
    setOk("");
    const supabase = createClient();
    const payload = {
      ...form,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = await supabase
      .from("shop_shipping_settings")
      .upsert({ shop_id: shopId, ...payload }, { onConflict: "shop_id" })
      .eq("shop_id", shopId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOk("Saved. Buyers will see these rates at checkout.");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h2 className="text-2xl font-bold text-[#3b2a22]">Shipping & pickup</h2>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm text-green-700">{ok}</p> : null}

      <div className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
        <h3 className="text-lg font-semibold">Fulfillment location</h3>
        <label className="block text-sm">
          Home province/state
          <select className={inp} value={form.fulfillment_province} onChange={(e) => setField("fulfillment_province", e.target.value)}>
            {[...CA_PROVINCES, ...US_STATES].map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
        <h3 className="text-lg font-semibold">Regional access</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.allow_national} onChange={(e) => setField("allow_national", e.target.checked)} />
          Allow national (out-of-province) orders within Canada
        </label>
        <div className="mt-3">
          <p className="text-sm font-medium">National regions (Canada)</p>
          <div className="mt-1 flex items-center gap-2">
            <button type="button" className="text-xs font-semibold text-[#c45c26]" onClick={() => toggleAll("national_regions", CA_PROVINCES, true)}>Select all</button>
            <button type="button" className="text-xs font-semibold text-[#c45c26]" onClick={() => toggleAll("national_regions", CA_PROVINCES, false)}>Unselect all</button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CA_PROVINCES.map((r) => (
              <label key={r.code} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={form.national_regions.includes(r.code)} onChange={() => toggleRegion("national_regions", r.code)} />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.ship_to_us} onChange={(e) => setField("ship_to_us", e.target.checked)} />
          Ship to United States
        </label>

        <div className="mt-3">
          <p className="text-sm font-medium">Excluded regions (Do not ship)</p>
          <p className="text-xs text-[#7a5c4e]">Supports wildcards like "US-*" to block entire countries.</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[...CA_PROVINCES, ...US_STATES].map((r) => (
              <label key={r.code} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={form.exclude_regions.includes(r.code)} onChange={() => toggleRegion("exclude_regions", r.code)} />
                {r.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <MethodSection
        title="Standard shipping (required)"
        form={form}
        setField={setField}
        method="standard"
        required
      />

      <MethodSection
        title="Express shipping (optional)"
        form={form}
        setField={setField}
        method="express"
      />

      <PickupSection form={form} setField={setField} />

      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="rounded-full bg-[#c45c26] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save shipping"}
      </button>
    </div>
  );
}

function MethodSection({ title, form, setField, method, required }) {
  const enabledKey = method === "standard" ? null : `${method}_enabled`;
  const enabled = method === "standard" ? true : !!form[enabledKey];

  return (
    <div className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        {enabledKey && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setField(enabledKey, e.target.checked)} />
            Enable
          </label>
        )}
      </div>
      {!enabled ? (
        <p className="mt-2 text-sm text-[#7a5c4e]">Disabled</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <RateGroup label="Home (local)" prefix={`${method}_home`} form={form} setField={setField} />
          <RateGroup label="National (CA out-of-province)" prefix={`${method}_national`} form={form} setField={setField} />
          <RateGroup label="United States" prefix={`${method}_us`} form={form} setField={setField} />
        </div>
      )}
      {method === "express" && enabled && (
        <div className="mt-3 flex items-center gap-4">
          <label className="text-sm">
            Rate mode
            <select className={inp} value={form.express_rate_mode} onChange={(e) => setField("express_rate_mode", e.target.value)}>
              <option value="flat">Flat per region</option>
              <option value="surcharge">Surcharge on Home base</option>
            </select>
          </label>
          {form.express_rate_mode === "surcharge" && (
            <label className="text-sm">
              Surcharge (cents)
              <input type="number" className={smallInp} value={form.express_surcharge_cents} onChange={(e) => setField("express_surcharge_cents", Number(e.target.value))} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function RateGroup({ label, prefix, form, setField }) {
  return (
    <div className="rounded-xl border border-[#e8d5c4] p-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs">
          Flat (cents)
          <input type="number" className={smallInp} value={form[`${prefix}_flat_cents`]} onChange={(e) => setField(`${prefix}_flat_cents`, Number(e.target.value))} />
        </label>
        <label className="text-xs">
          Free over (cents)
          <input type="number" className={smallInp} value={form[`${prefix}_free_over_cents`] ?? ""} onChange={(e) => setField(`${prefix}_free_over_cents`, e.target.value ? Number(e.target.value) : null)} />
        </label>
        <label className="text-xs">
          Min days
          <input type="number" className={smallInp} value={form[`${prefix}_min_days`]} onChange={(e) => setField(`${prefix}_min_days`, Number(e.target.value))} />
        </label>
        <label className="text-xs">
          Max days
          <input type="number" className={smallInp} value={form[`${prefix}_max_days`]} onChange={(e) => setField(`${prefix}_max_days`, Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

function PickupSection({ form, setField }) {
  const enabled = form.pickup_enabled;
  return (
    <div className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Local pickup</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setField("pickup_enabled", e.target.checked)} />
          Enable
        </label>
      </div>
      {!enabled ? (
        <p className="mt-2 text-sm text-[#7a5c4e]">Disabled</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <PickupRateGroup label="Home" prefix="pickup_home" form={form} setField={setField} />
          <PickupRateGroup label="National" prefix="pickup_national" form={form} setField={setField} />
          <PickupRateGroup label="United States" prefix="pickup_us" form={form} setField={setField} />
        </div>
      )}
      {enabled && (
        <label className="mt-3 block text-sm">
          Ready in (hours)
          <input type="number" className={smallInp} value={form.pickup_ready_hours} onChange={(e) => setField("pickup_ready_hours", Number(e.target.value))} />
        </label>
      )}
    </div>
  );
}

function PickupRateGroup({ label, prefix, form, setField }) {
  return (
    <div className="rounded-xl border border-[#e8d5c4] p-3">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-[#7a5c4e]">Free by default. Enter an amount only if you charge a pickup/handling fee.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs">
          Flat (cents)
          <input type="number" className={smallInp} value={form[`${prefix}_flat_cents`]} onChange={(e) => setField(`${prefix}_flat_cents`, Number(e.target.value))} />
        </label>
        <label className="text-xs">
          Free over (cents)
          <input type="number" className={smallInp} value={form[`${prefix}_free_over_cents`] ?? ""} onChange={(e) => setField(`${prefix}_free_over_cents`, e.target.value ? Number(e.target.value) : null)} />
        </label>
      </div>
    </div>
  );
}
