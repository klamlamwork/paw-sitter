"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_KEY = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();

let bootstrapPromise = null;

function ensureMapsBootstrap(apiKey) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve();
  }
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = new Promise((resolve, reject) => {
    const g = { key: apiKey, v: "weekly" };
    ((g) => {
      var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
      b = b[c] || (b[c] = {});
      var d = b.maps || (b.maps = {}), r = new Set(), e = new URLSearchParams(),
        u = () => h || (h = new Promise(async (f, n) => {
          await (a = m.createElement("script"));
          e.set("libraries", [...r] + "");
          for (k in g) e.set(k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()), g[k]);
          e.set("callback", c + ".maps." + q);
          a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
          d[q] = f;
          a.onerror = () => (h = n(Error(p + " could not load. Check API key, billing, and referrer restrictions.")));
          a.nonce = m.querySelector("script[nonce]")?.nonce || "";
          m.head.append(a);
        }));
      d[l] ? console.warn(p + " only loads once. Ignoring:", g) : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
    })(g);

    window.google.maps.importLibrary("places").then(() => resolve()).catch((err) => {
      bootstrapPromise = null;
      reject(err);
    });
  });

  return bootstrapPromise;
}

function componentText(components, type) {
  const list = components || [];
  const c = list.find((x) => (x.types || []).includes(type));
  return c?.longText || c?.long_name || c?.shortText || "";
}

function parseComponents(components) {
  const streetNumber = componentText(components, "street_number");
  const route = componentText(components, "route");
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
  return {
    address_line1: line1,
    postal_code: componentText(components, "postal_code"),
  };
}

function suggestionInCity(suggestion, cityName) {
  if (!cityName) return true;
  const city = String(cityName).toLowerCase();
  const blob = [
    suggestion.placePrediction?.text?.text,
    suggestion.placePrediction?.mainText?.text,
    suggestion.placePrediction?.secondaryText?.text,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return blob.includes(city);
}

function localityMatchesCity(components, cityName) {
  if (!cityName) return true;
  const city = String(cityName).toLowerCase();
  const locality =
    componentText(components, "locality") ||
    componentText(components, "postal_town") ||
    componentText(components, "sublocality") ||
    componentText(components, "administrative_area_level_3");
  if (!locality) return true;
  const loc = locality.toLowerCase();
  return loc.includes(city) || city.includes(loc);
}

export default function AddressAutocomplete({
  value = {},
  onChange,
  countryCode,
  cityName = "",
  label = "Street address (optional)",
  disabled = false,
}) {
  const [manualOnly, setManualOnly] = useState(!API_KEY);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState(value.address_line1 || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loadingSug, setLoadingSug] = useState(false);
  const [local, setLocal] = useState({
    address_line1: value.address_line1 || "",
    address_line2: value.address_line2 || "",
    postal_code: value.postal_code || "",
  });
  const debounceRef = useRef(null);
  const boxRef = useRef(null);
  const placesReady = useRef(false);

  useEffect(() => {
    setLocal({
      address_line1: value.address_line1 || "",
      address_line2: value.address_line2 || "",
      postal_code: value.postal_code || "",
    });
    if (value.address_line1) setQuery(value.address_line1);
  }, [value.address_line1, value.address_line2, value.postal_code]);

  useEffect(() => {
    if (!API_KEY) {
      setManualOnly(true);
      setLoadError(
        "No NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in this build. Set it in Vercel → Environment Variables (Production), then Redeploy."
      );
      return;
    }
    let cancelled = false;
    setLoadError("");
    ensureMapsBootstrap(API_KEY)
      .then(() => {
        if (cancelled) return;
        placesReady.current = true;
        setManualOnly(false);
      })
      .catch((err) => {
        console.error("[AddressAutocomplete] bootstrap", err);
        setLoadError(err?.message || String(err));
        setManualOnly(true);
        placesReady.current = false;
        bootstrapPromise = null;
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onDoc(e) {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fetchSuggestions = useCallback(async (input) => {
    if (!placesReady.current || !input || input.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setLoadingSug(true);
    try {
      const { AutocompleteSuggestion } = await window.google.maps.importLibrary("places");
      const trimmed = input.trim();
      const req = {
        input: cityName ? `${trimmed} ${cityName}` : trimmed,
        includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
      };
      if (countryCode) {
        req.includedRegionCodes = [String(countryCode).toLowerCase()];
      }
      const { suggestions: list } =
        await AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
      const filtered = (list || []).filter((s) => suggestionInCity(s, cityName));
      setSuggestions(filtered);
      setOpen(true);
      setLoadError("");
    } catch (err) {
      console.error("[AddressAutocomplete] suggest", err);
      setLoadError(
        err?.message ||
          "Places suggestions failed. Enable Places API (New) on the key's project."
      );
      setSuggestions([]);
    } finally {
      setLoadingSug(false);
    }
  }, [countryCode, cityName]);

  function onQueryChange(text) {
    setQuery(text);
    setLocal((L) => ({ ...L, address_line1: text }));
    onChange?.({
      address_line1: text,
      address_line2: local.address_line2,
      postal_code: local.postal_code,
      lat: value.lat,
      lng: value.lng,
      formatted: text,
    });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (manualOnly || !placesReady.current) return;
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 280);
  }

  async function pickSuggestion(suggestion) {
    try {
      setOpen(false);
      setLoadingSug(true);
      const prediction = suggestion.placePrediction;
      if (!prediction) return;
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ["formattedAddress", "location", "addressComponents"],
      });
      const loc = place.location;
      if (!loc) {
        setStatus("Could not read coordinates for that place.");
        return;
      }
      if (!localityMatchesCity(place.addressComponents, cityName)) {
        const locality =
          componentText(place.addressComponents, "locality") ||
          componentText(place.addressComponents, "postal_town") ||
          "another city";
        setStatus(`That address is in ${locality}, not ${cityName}. Pick one in ${cityName}.`);
        return;
      }
      const lat = typeof loc.lat === "function" ? loc.lat() : Number(loc.lat);
      const lng = typeof loc.lng === "function" ? loc.lng() : Number(loc.lng);
      const parsed = parseComponents(place.addressComponents);
      const line1 =
        parsed.address_line1 ||
        place.formattedAddress ||
        prediction.text?.text ||
        query;

      const nextLocal = {
        address_line1: line1,
        address_line2: local.address_line2,
        postal_code: parsed.postal_code || local.postal_code,
      };
      setLocal(nextLocal);
      setQuery(line1);
      setStatus("Address set — map coordinates updated for radius matching.");
      onChange?.({
        ...nextLocal,
        lat,
        lng,
        formatted: place.formattedAddress || line1,
      });
    } catch (err) {
      console.error("[AddressAutocomplete] pick", err);
      setStatus(err?.message || "Failed to load place details.");
    } finally {
      setLoadingSug(false);
    }
  }

  function emitExtra(patch) {
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
    setQuery("");
    setSuggestions([]);
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

  return (
    <div className="space-y-2" ref={boxRef}>
      <p className="text-sm font-semibold text-[#3b2a22]">{label}</p>
      <p className="text-xs text-[#7a5c4e]">
        Optional. City sets timezone; street pin improves km accuracy.
      </p>

      {loadError ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p className="font-semibold">Google autocomplete issue</p>
          <p className="mt-1 break-words">{loadError}</p>
          <p className="mt-2">You can still type the address manually.</p>
        </div>
      ) : null}

      <label className="relative block text-xs text-[#7a5c4e]">
        Street / road + number
        <input
          type="text"
          disabled={disabled}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder={
            cityName ? `Start typing street in ${cityName}…` : "Start typing address…"
          }
          className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
          autoComplete="off"
        />
        {loadingSug ? (
          <span className="absolute right-3 top-8 text-[10px] text-[#7a5c4e]">…</span>
        ) : null}
        {open && suggestions.length > 0 ? (
          <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[#e8d5c4] bg-white py-1 shadow-lg">
            {suggestions.map((s, idx) => {
              const text =
                s.placePrediction?.text?.text ||
                s.placePrediction?.mainText?.text ||
                "Place";
              const secondary = s.placePrediction?.secondaryText?.text || "";
              return (
                <li key={idx}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-[#3b2a22] hover:bg-[#fff8f0]"
                    onClick={() => pickSuggestion(s)}
                  >
                    <span className="font-medium">{text}</span>
                    {secondary ? (
                      <span className="mt-0.5 block text-xs text-[#7a5c4e]">{secondary}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-[#7a5c4e]">
          Apt / unit (optional)
          <input type="text" disabled={disabled} value={local.address_line2} onChange={(e) => emitExtra({ address_line2: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-[#7a5c4e]">
          Postal code
          <input type="text" disabled={disabled} value={local.postal_code} onChange={(e) => emitExtra({ postal_code: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {status ? <p className="text-xs text-green-800">{status}</p> : null}
        {query || value.lat ? (
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
