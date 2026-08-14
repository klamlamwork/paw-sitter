"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AccountLocationClient({ customerId }) {
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("profiles")
          .select("service_city")
          .eq("id", customerId)
          .single();
        if (error) throw error;
        if (!cancelled) setCity(data?.service_city || "");
      } catch (e) {
        if (!cancelled) setErr(e.message || "Could not load location");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) return <p className="text-sm text-[#7a5c4e]">Loading location…</p>;
  if (err) return <p className="text-sm text-red-600">{err}</p>;

  return (
    <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4">
      <h3 className="text-lg font-semibold">Location</h3>
      <p className="mt-1 text-sm text-[#7a5c4e]">{city || "No city set"}</p>
    </div>
  );
}
