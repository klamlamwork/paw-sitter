"use client";

import { useMemo, useState, useEffect } from "react";
import { countryList, locationsByCountry, findLocationById, locationLabel } from "@/lib/locations";

export default function LocationPicker({ valueId, onChange, label = "City & country" }) {
  const byCountry = useMemo(() => locationsByCountry(), []);
  const countries = useMemo(() => countryList(), []);
  const selected = valueId ? findLocationById(valueId) : null;
  const [country, setCountry] = useState(selected?.country || "");

  useEffect(() => {
    if (selected?.country) setCountry(selected.country);
  }, [selected?.country]);

  const cities = country ? byCountry[country] || [] : [];

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-[#3b2a22]">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-[#7a5c4e]">
          Country
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              onChange(null);
            }}
            className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
          >
            <option value="">Select country</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[#7a5c4e]">
          City
          <select
            value={valueId || ""}
            disabled={!country}
            onChange={(e) => {
              const loc = findLocationById(e.target.value);
              if (!loc) {
                onChange(null);
                return;
              }
              onChange({
                location_id: loc.id,
                city: loc.city,
                country: loc.country,
                country_code: loc.countryCode,
                timezone: loc.timezone,
                lat: loc.lat,
                lng: loc.lng,
              });
            }}
            className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Select city</option>
            {cities.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.city}</option>
            ))}
          </select>
        </label>
      </div>
      {selected ? (
        <p className="text-xs text-[#7a5c4e]">
          {locationLabel(selected)} · timezone <strong>{selected.timezone}</strong>
        </p>
      ) : null}
    </div>
  );
}
