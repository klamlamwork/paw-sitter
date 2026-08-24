"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhoneVerification from "@/components/PhoneVerification";

export default function SitterApplicationBar({ sitter }) {
  const router = useRouter();
  const status = sitter?.application_status || (sitter?.is_active ? "approved" : "pending");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(sitter?.phone_e164 || "");

  if (status === "approved") return null;

  async function submit() {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/sitter/submit", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit.");
      setOk("Application submitted. We will email you after review.");
      router.refresh();
    } catch (err) {
      setError(err.message || "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-5">
      <h2 className="text-lg font-semibold text-[#3b2a22]">Sitter application</h2>
      <p className="text-sm text-[#7a5c4e]">
        Status: <strong className="capitalize text-[#c45c26]">{status}</strong>.
        Fill every profile, service, and weekly-hours field below, tap Save dashboard, verify your phone, then submit.
      </p>
      <PhoneVerification
        verifiedE164={verified}
        onVerified={(e164) => {
          setVerified(e164);
          router.refresh();
        }}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm text-green-800">{ok}</p> : null}
      {status !== "submitted" ? (
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-full bg-[#3b2a22] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Checking…" : "Submit application"}
        </button>
      ) : (
        <p className="text-sm text-[#5c4033]">Thanks — your application is in review.</p>
      )}
    </div>
  );
}
