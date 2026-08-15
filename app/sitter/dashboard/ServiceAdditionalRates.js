"use client";

import { keep90, normalizeServiceType } from "@/lib/bookingPricing";

function MoneyField({ label, unit, value, onChange }) {
  const n = Number(value) || 0;
  return (
    <label className="block text-xs">
      <span className="font-medium text-[#3b2a22]">{label}</span>
      <span className="ml-1 text-[#7a5c4e]">{unit}</span>
      <input
        type="number"
        min="0"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1.5"
      />
      <span className="mt-1 block text-[#c45c26]">You keep: ${keep90(n).toFixed(1)}</span>
    </label>
  );
}

export default function ServiceAdditionalRates({ svc, onChange }) {
  const type = normalizeServiceType(svc.service_type);
  const overnight = type === "house_sit" || type === "boarding";
  const timed = type === "drop_in" || type === "walking";
  const holidayUnit = overnight ? "/ night" : type === "walking" ? "/ walk" : "/ visit";
  const extraUnit = overnight ? "/ night" : type === "walking" ? "/ walk" : "/ visit";

  return (
    <div className="mt-3 rounded-lg border border-[#f0e0d2] bg-[#fff8f0] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#7a5c4e]">Additional rates</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <MoneyField label="Holiday Rate" unit={`$ ${holidayUnit}`} value={svc.rate_holiday} onChange={(v) => onChange({ rate_holiday: v })} />
        <MoneyField label="Additional Cat/Dog Rate" unit={`+ $ ${extraUnit}`} value={svc.extra_pet_rate} onChange={(v) => onChange({ extra_pet_rate: v })} />
        {timed ? (
          <MoneyField
            label="60 minute rate"
            unit={type === "walking" ? "+ $ / walk" : "+ $ / visit"}
            value={svc.rate_60min}
            onChange={(v) => onChange({ rate_60min: v })}
          />
        ) : null}
      </div>
    </div>
  );
}
