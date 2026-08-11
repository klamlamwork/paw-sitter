"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
export default function LoginClient() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const err = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(err ? "Login failed. Try again." : "");
  async function signInWithGoogle() {
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: origin + "/auth/callback?next=" + encodeURIComponent(next) },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <div className="w-full rounded-3xl border border-[#e8d5c4] bg-[#fff8f0]/95 p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo.svg" alt="Paw Sitter" width={64} height={64} className="h-16 w-16" />
          <h1 className="mt-4 text-2xl font-bold text-[#3b2a22]">Welcome to Paw Sitter</h1>
          <p className="mt-2 text-sm text-[#7a5c4e]">Sign in with Google to book or manage sitting.</p>
        </div>
        {message ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700">{message}</p> : null}
        <button type="button" onClick={signInWithGoogle} disabled={loading}
          className="flex w-full items-center justify-center rounded-full border border-[#e8d5c4] bg-white px-4 py-3 text-sm font-semibold text-[#3b2a22] disabled:opacity-60">
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}
