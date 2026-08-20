"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LocationPicker from "@/components/LocationPicker";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { findLocationById } from "@/lib/locations";

export default function AccountLocationClient({ profile }) {
  const router = useRouter();
  const [locId, setLocId] = useState(profile.location_id || "");
  const [fields, setFields] = useState({
    city: profile.city || "",
    country: profile.country || "",
    country_code: profile.country_code || "",
    timezone: profile.timezone || "",
    lat: profile.lat,
    lng: profile.lng,
    full_name: profile.full_name || "",
    address_line1: profile.address_line1 || "",
    address_line2: profile.address_line2 || "",
    postal_code: profile.postal_code || "",
  });
  const [cityLatLng, setCityLatLng] = useState({ lat: profile.lat, lng: profile.lng });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const countryCode = fields.country_code || findLocationById(locId)?.countryCode || "";

  async function save() {
    setSaving(true); setError(""); setOk("");
    if (!locId) {
      setError("Please choose your city from the list.");
      setSaving(false);
      return;
    }
    const supabase = createClient();
    const { error: err } = await supabase.from("profiles").update({
      full_name: fields.full_name,
      location_id: locId,
      city: fields.city,
      country: fields.country,
      country_code: fields.country_code,
      timezone: fields.timezone,
      lat: fields.lat,
      lng: fields.lng,
      address_line1: fields.address_line1 || null,
      address_line2: fields.address_line2 || null,
      postal_code: fields.postal_code || null,
    }).eq("id", profile.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setOk("Location saved. Precise address improves sitter distance matching.");
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
      <h2 className="text-lg font-semibold text-[#3b2a22]">Your service location</h2>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        City sets timezone. Optional street address sets a more accurate map pin for km matching.
      </p>
      <label className="mt-3 block text-sm">
        Full name
        <input value={fields.full_name} onChange={(e) => setFields({ ...fields, full_name: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" />
      </label>
      <div className="mt-3">
        <LocationPicker
          valueId={locId}
          onChange={(loc) => {
            if (!loc) {
              setLocId("");
              setFields((f) => ({ ...f, city: "", country: "", country_code: "", timezone: "", lat: null, lng: null }));
              setCityLatLng({ lat: null, lng: null });
              return;
            }
            setLocId(loc.location_id);
            setCityLatLng({ lat: loc.lat, lng: loc.lng });
            setFields((f) => ({
              ...f,
              city: loc.city,
              country: loc.country,
              country_code: loc.country_code,
              timezone: loc.timezone,
              lat: loc.lat,
              lng: loc.lng,
              address_line1: "",
              address_line2: "",
              postal_code: "",
            }));
          }}
        />
      </div>
      <div className="mt-4">
        <AddressAutocomplete
          countryCode={countryCode}
          cityName={fields.city}
          cityCoords={cityLatLng}
          disabled={!locId}
          value={{
            address_line1: fields.address_line1,
            address_line2: fields.address_line2,
            postal_code: fields.postal_code,
            lat: fields.lat,
            lng: fields.lng,
          }}
          onChange={(addr) => {
            setFields((f) => ({
              ...f,
              address_line1: addr.address_line1 || "",
              address_line2: addr.address_line2 ?? f.address_line2,
              postal_code: addr.postal_code || "",
              lat: addr.clearCoords ? cityLatLng.lat : addr.lat != null ? addr.lat : f.lat,
              lng: addr.clearCoords ? cityLatLng.lng : addr.lng != null ? addr.lng : f.lng,
            }));
          }}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="mt-2 text-sm text-green-700">{ok}</p> : null}
      <button type="button" disabled={saving} onClick={save} className="mt-4 rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? "Saving..." : "Save location"}
      </button>
    </div>
  );
}
