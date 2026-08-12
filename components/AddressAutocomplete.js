"use client";

import { useEffect, useRef, useState } from "react";

const API_KEY = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();

let mapsLoadPromise = null;

function loadGoogleMaps(apiKey) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google.maps);
  }
  if (mapsLoadPromise) return mapsLoadPromise;

  mapsLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-gmaps-places]");
    const done = () => {
      if (window.google?.maps?.importLibrary) resolve(window.google.maps);
      else reject(new Error("google.maps.importLibrary missing after script load"));
    };
    if (existing) {
      if (window.google?.maps?.importLibrary) done();
      else {
        existing.addEventListener("load", done);
        existing.addEventListener("error", () =>
          reject(new Error("Existing Maps script failed to load"))
        );
      }
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(apiKey) +
      "&v=weekly&loading=async";
    script.async = true;
    script.dataset.gmapsPlaces = "1";
    script.onload = done;
    script.onerror = () =>
      reject(
        new Error(
          "Script blocked or invalid key. Check billing, API enablement, and HTTP referrer restrictions."
        )
      );
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

function componentLongName(components, type) {
  const list = components || [];
  const c = list.find((x) => (x.types || []).includes(type));
  return c?.longText || c?.long_name || "";
}

function parseNewAddressComponents(components) {
  const streetNumber = componentLongName(components, "street_number");
  const route = componentLongName(components, "route");
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
  return {
    address_line1: line1,
    postal_code: componentLongName(components, "postal_code"),
  };
}

export default function AddressAutocomplete({
  value = {},
  onChange,
  countryCode,
  label = "Street address (optional)",
  disabled = false,
}) {
  const hostRef = useRef(null);
  const widgetRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [manual, setManual] = useState(!API_KEY);
  const [loadError, setLoadError] = useState("");
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
    if (!API_KEY) {
      setManual(true);
      setLoadError(
        "No NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in this deployment. Add it in Vercel → Environment Variables, then Redeploy."
      );
      return;
    }
    if (disabled || manual) return;
    if (!hostRef.current) return;

    let cancelled = false;
    setLoadError("");

    (async () => {
      try {
        await loadGoogleMaps(API_KEY);
        if (cancelled || !hostRef.current) return;

        const placesLib = await window.google.maps.importLibrary("places");
        const PlaceAutocompleteElement =
          placesLib.PlaceAutocompleteElement ||
          window.google.maps.places?.PlaceAutocompleteElement;

        if (!PlaceAutocompleteElement) {
          throw new Error(
            "PlaceAutocompleteElement not available. Enable Places API (New) + Maps JavaScript API, then retry."
          );
        }

        hostRef.current.innerHTML = "";
        const el = new PlaceAutocompleteElement(
          countryCode
            ? { includedRegionCodes: [String(countryCode).toLowerCase()] }
            : {}
        );
        el.id = "paw-place-autocomplete";
        el.style.display = "block";
        el.style.width = "100%";
        el.style.borderRadius = "0.75rem";

        hostRef.current.appendChild(el);
        widgetRef.current = el;
        setReady(true);

        el.addEventListener("gmp-select", async (event) => {
          try {
            const prediction = event.placePrediction;
            if (!prediction) return;
            const place = prediction.toPlace ? prediction.toPlace() : prediction;
            await place.fetchFields({
              fields: ["formattedAddress", "location", "addressComponents"],
            });

            const loc = place.location;
            if (!loc) {
              setStatus("Could not read coordinates for that place.");
              return;
            }
            const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
            const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
            const parsed = parseNewAddressComponents(place.addressComponents);
            const line1 = parsed.address_line1 || place.formattedAddress || "";

            const next = {
              address_line1: line1,
              address_line2: local.address_line2 || "",
              postal_code: parsed.postal_code || "",
              lat,
              lng,
              formatted: place.formattedAddress || line1,
            };
            setLocal({
              address_line1: next.address_line1,
              address_line2: next.address_line2,
              postal_code: next.postal_code,
            });
            setStatus("Address set — map coordinates updated for radius matching.");
            onChange?.(next);
          } catch (e) {
            console.error("[AddressAutocomplete] select", e);
            setStatus(e?.message || "Failed to read selected place.");
          }
        });
      } catch (err) {
        console.error("[AddressAutocomplete]", err);
        setLoadError(err?.message || String(err));
        setManual(true);
        mapsLoadPromise = null;
      }
    })();

    return () => {
      cancelled = true;
      if (hostRef.current) hostRef.current.innerHTML = "";
      widgetRef.current = null;
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

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-[#3b2a22]">{label}</p>
      <p className="text-xs text-[#7a5c4e]">
        Optional. City/timezone come from the city list. Street pin improves km accuracy.
      </p>

      {loadError ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p className="font-semibold">Google Maps autocomplete unavailable</p>
          <p className="mt-1">{loadError}</p>
          <p className="mt-2">You can still type the address manually below.</p>
        </div>
      ) : null}

      {!manual ? (
        <div>
          <p className="text-xs text-[#7a5c4e]">Street / road + number</p>
          <div
            ref={hostRef}
            className="mt-1 min-h-[42px] w-full rounded-xl border border-[#e8d5c4] bg-white px-1 py-1 [&_input]:w-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-2 [&_input]:py-2 [&_input]:text-sm [&_input]:outline-none"
          />
          {!ready && !loadError ? (
            <p className="mt-1 text-xs text-[#7a5c4e]">Loading Google autocomplete…</p>
          ) : null}
        </div>
      ) : (
        <label className="block text-xs text-[#7a5c4e]">
          Street / road + number
          <input
            type="text"
            disabled={disabled}
            value={local.address_line1}
            onChange={(e) => emitManual({ address_line1: e.target.value })}
            placeholder="e.g. 123 King St W"
            className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
          />
        </label>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-[#7a5c4e]">
          Apt / unit (optional)
          <input
            type="text"
            disabled={disabled}
            value={local.address_line2}
            onChange={(e) => emitManual({ address_line2: e.target.value })}
            className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-[#7a5c4e]">
          Postal code
          <input
            type="text"
            disabled={disabled}
            value={local.postal_code}
            onChange={(e) => emitManual({ postal_code: e.target.value })}
            className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {status ? <p className="text-xs text-green-800">{status}</p> : null}
        {local.address_line1 || value.lat ? (
          <button
            type="button"
            onClick={clearAddress}
            className="text-xs font-semibold text-[#c45c26] hover:underline"
          >
            Clear street address
          </button>
        ) : null}
        {value.lat != null && value.lng != null ? (
          <p className="text-xs text-[#7a5c4e]">
            Pin: {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}
          </p>
        ) : null}
        {API_KEY && manual ? (
          <button
            type="button"
            className="text-xs font-semibold text-[#5c4033] underline"
            onClick={() => {
              setManual(false);
              setLoadError("");
              mapsLoadPromise = null;
            }}
          >
            Retry Google autocomplete
          </button>
        ) : null}
      </div>
    </div>
  );
}
