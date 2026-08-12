"use client";

import { useEffect, useRef, useState } from "react";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

let mapsLoadPromise = null;

function loadGoogleMaps(apiKey) {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps?.places) return Promise.resolve(window.google.maps);
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-gmaps-places]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(apiKey) +
      "&libraries=places&loading=async";
    script.async = true;
    script.dataset.gmapsPlaces = "1";
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

function parseAddressComponents(components) {
  const get = (type) => {
    const c = (components || []).find((x) => x.types.includes(type));
    return c?.long_name || "";
  };
  const streetNumber = get("street_number");
  const route = get("route");
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
  return {
    address_line1: line1 || "",
    postal_code: get("postal_code"),
  };
}

export default function AddressAutocomplete({
  value = {},
  onChange,
  countryCode,
  label = "Street address (optional)",
  disabled = false,
}) {
  const inputRef = useRef(null);
  const acRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [manual, setManual] = useState(false);
  const [local, setLocal] = useState({
    address_line1: value.address_line1 || "",
    address_line2: value.address_line2 || "",
    postal_code: value.postal_code || "",
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    setLocal({
      address_line1: value.address_line1 || "",
      address_line2: value.address_line2 || "",
      postal_code: value.postal_code || "",
    });
  }, [value.address_line1, value.address_line2, value.postal_code]);

  useEffect(() => {
    if (!API_KEY || disabled || manual) return;
    let cancelled = false;
    loadGoogleMaps(API_KEY)
      .then((maps) => {
        if (cancelled || !inputRef.current) return;
        setReady(true);
        if (acRef.current) return;
        const opts = {
          fields: ["address_components", "geometry", "formatted_address"],
          types: ["address"],
        };
        if (countryCode) {
          opts.componentRestrictions = { country: String(countryCode).toLowerCase() };
        }
        const ac = new maps.places.Autocomplete(inputRef.current, opts);
        acRef.current = ac;
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place?.geometry?.location) {
            setStatus("Could not read that address. Try again or enter manually.");
            return;
          }
          const parsed = parseAddressComponents(place.address_components);
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const next = {
            address_line1: parsed.address_line1 || place.formatted_address || "",
            address_line2: local.address_line2 || "",
            postal_code: parsed.postal_code || "",
            lat,
            lng,
            formatted: place.formatted_address || "",
          };
          setLocal({
            address_line1: next.address_line1,
            address_line2: next.address_line2,
            postal_code: next.postal_code,
          });
          setStatus("Address set — map coordinates updated for radius matching.");
          onChange?.(next);
        });
      })
      .catch(() => {
        setStatus("Google Maps unavailable. You can type the address manually.");
        setManual(true);
      });
    return () => {
      cancelled = true;
    };
  }, [API_KEY, disabled, manual, countryCode]);

  function emitManual(patch) {
    const nextLocal = { ...local, ...patch };
    setLocal(nextLocal);
    onChange?.({
      address_line1: nextLocal.address_line1,
      address_line2: nextLocal.address_line2,
      postal_code: nextLocal.postal_code,
      lat: value.lat,
      lng: value.lng,
      formatted: nextLocal.address_line1,
    });
  }

  function clearAddress() {
    setLocal({ address_line1: "", address_line2: "", postal_code: "" });
    setStatus("");
    onChange?.({
      address_line1: "",
      address_line2: "",
      postal_code: "",
      lat: null,
      lng: null,
      formatted: "",
      clearCoords: true,
    });
  }

  if (!API_KEY) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#3b2a22]">{label}</p>
        <p className="text-xs text-[#7a5c4e]">
          Optional. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (Places API) for Google autocomplete; until then type manually (city pin used for km).
        </p>
        <label className="block text-xs text-[#7a5c4e]">
          Street / road + number
          <input type="text" disabled={disabled} value={local.address_line1} onChange={(e) => emitManual({ address_line1: e.target.value })} placeholder="e.g. 123 King St W" className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-[#7a5c4e]">
            Apt / unit (optional)
            <input type="text" disabled={disabled} value={local.address_line2} onChange={(e) => emitManual({ address_line2: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-[#7a5c4e]">
            Postal code
            <input type="text" disabled={disabled} value={local.postal_code} onChange={(e) => emitManual({ postal_code: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-[#3b2a22]">{label}</p>
      <p className="text-xs text-[#7a5c4e]">
        Optional. Start typing and pick a Google suggestion for precise coordinates. City/timezone still come from the city list.
      </p>
      <label className="block text-xs text-[#7a5c4e]">
        Street / road + number
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          defaultValue={local.address_line1}
          key={local.address_line1}
          placeholder={ready ? "Start typing address…" : "Loading Google…"}
          className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
          autoComplete="off"
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-[#7a5c4e]">
          Apt / unit (optional)
          <input type="text" disabled={disabled} value={local.address_line2} onChange={(e) => emitManual({ address_line2: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-[#7a5c4e]">
          Postal code
          <input type="text" disabled={disabled} value={local.postal_code} onChange={(e) => emitManual({ postal_code: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {status ? <p className="text-xs text-green-800">{status}</p> : null}
        {(local.address_line1 || value.lat) ? (
          <button type="button" onClick={clearAddress} className="text-xs font-semibold text-[#c45c26] hover:underline">
            Clear street address
          </button>
        ) : null}
        {value.lat != null && value.lng != null ? (
          <p className="text-xs text-[#7a5c4e]">
            Pin: {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
