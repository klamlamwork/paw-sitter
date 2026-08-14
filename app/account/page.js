"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AccountLocationClient from "./AccountLocationClient";
import MyPawKidsClient from "./MyPawKidsClient";

export default function AccountPage() {
  const [customerId, setCustomerId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) {
          setCustomerId(session?.user?.id || null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="mt-2 text-sm text-[#7a5c4e]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-bold">Account</h1>
      {!customerId ? (
        <p className="mt-2 text-sm text-[#7a5c4e]">Please log in to view your account.</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <AccountLocationClient customerId={customerId} />
          <MyPawKidsClient customerId={customerId} />
        </div>
      )}
    </div>
  );
}
