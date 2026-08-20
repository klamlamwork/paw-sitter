"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordClient() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data?.user) {
        window.location.href = "/login";
        return;
      }
      setReady(true);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      window.location.href = "/account";
    } catch (err) {
      setMessage(err.message || "Could not set password");
      setLoading(false);
    }
  }

  if (checking || !ready) {
    return <div className="p-10 text-center text-sm text-[#7a5c4e]">Checking your reset link…</div>;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <div className="w-full rounded-3xl border border-[#e8d5c4] bg-[#fff8f0]/95 p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-[#3b2a22]">Set a password</h1>
        <p className="mt-2 text-sm text-[#7a5c4e]">
          This adds a password to your existing account. You can still sign in with Google.
        </p>
        {message ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700">{message}</p> : null}
        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="font-medium text-[#3b2a22]">New password</span>
            <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#3b2a22]">Confirm password</span>
            <input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
          </label>
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center rounded-full bg-[#c45c26] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Saving…" : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}
