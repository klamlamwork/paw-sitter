"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LocationPicker from "@/components/LocationPicker";

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
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    setOk("");
    if (!locId) {
      setError("Please choose your city from the list.");
      setSaving(false);
      return;
    }
    const supabase = createClient();
    const { error: err } = await supabase
      .from("profiles")
      .update({
        full_name: fields.full_name,
        location_id: locId,
        city: fields.city,
        country: fields.country,
        country_code: fields.country_code,
        timezone: fields.timezone,
        lat: fields.lat,
        lng: fields.lng,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOk("Location saved. Booking will match sitters who cover this area.");
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
      <h2 className="text-lg font-semibold text-[#3b2a22]">Your service location</h2>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        City and timezone are shared so booking times and service areas match.
      </p>
      <label className="mt-3 block text-sm">
        Full name
        <input
          value={fields.full_name}
          onChange={(e) => setFields({ ...fields, full_name: e.target.value })}
          className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2"
        />
      </label>
      <div className="mt-3">
        <LocationPicker
          valueId={locId}
          onChange={(loc) => {
            if (!loc) {
              setLocId("");
              setFields((f) => ({
                ...f,
                city: "",
                country: "",
                country_code: "",
                timezone: "",
                lat: null,
                lng: null,
              }));
              return;
            }
            setLocId(loc.location_id);
            setFields((f) => ({
              ...f,
              city: loc.city,
              country: loc.country,
              country_code: loc.country_code,
              timezone: loc.timezone,
              lat: loc.lat,
              lng: loc.lng,
            }));
          }}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="mt-2 text-sm text-green-700">{ok}</p> : null}
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="mt-4 rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save location"}
      </button>
    </div>
  );
}
