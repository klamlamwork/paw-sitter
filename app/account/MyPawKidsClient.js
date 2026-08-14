"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MyPawKidsClient({ customerId }) {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("pets")
          .select("id, name, species, breed, photo_url, profile_id")
          .eq("profile_id", customerId)
          .order("name");
        if (error) throw error;
        if (!cancelled) setPets(data || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Could not load pets");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) return <p className="text-sm text-[#7a5c4e]">Loading pets…</p>;
  if (err) return <p className="text-sm text-red-600">{err}</p>;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">My Paw Kids</h3>
      {pets.length === 0 ? (
        <p className="text-sm text-[#7a5c4e]">No pets yet. Add one below.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pets.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-3">
              <img src={p.photo_url || "/placeholder-pet.png"} alt={p.name} className="h-16 w-16 rounded-full object-cover" />
              <div>
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-[#7a5c4e]">{p.species}{p.breed ? ` • ${p.breed}` : ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
