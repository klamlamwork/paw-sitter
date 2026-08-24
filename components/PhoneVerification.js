"use client";

import { useRef, useState } from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

const COUNTRY_CODES = [
  { iso: "CA", name: "Canada", dial: "1" },
  { iso: "US", name: "United States", dial: "1" },
  { iso: "GB", name: "United Kingdom", dial: "44" },
  { iso: "AU", name: "Australia", dial: "61" },
  { iso: "NZ", name: "New Zealand", dial: "64" },
  { iso: "IE", name: "Ireland", dial: "353" },
  { iso: "DE", name: "Germany", dial: "49" },
  { iso: "FR", name: "France", dial: "33" },
  { iso: "IN", name: "India", dial: "91" },
  { iso: "PH", name: "Philippines", dial: "63" },
  { iso: "MX", name: "Mexico", dial: "52" },
  { iso: "SG", name: "Singapore", dial: "65" },
  { iso: "HK", name: "Hong Kong", dial: "852" },
  { iso: "JP", name: "Japan", dial: "81" },
  { iso: "KR", name: "South Korea", dial: "82" },
  { iso: "CN", name: "China", dial: "86" },
  { iso: "BR", name: "Brazil", dial: "55" },
  { iso: "AE", name: "UAE", dial: "971" },
];

function toE164(dial, national) {
  let digits = String(national || "").replace(/\D/g, "");
  const d = String(dial || "").replace(/\D/g, "");
  if (d === "1" && digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (!d || digits.length < 7) return "";
  return `+${d}${digits}`;
}

export default function PhoneVerification({ verifiedE164 = "", onVerified }) {
  const [dial, setDial] = useState("1");
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState(verifiedE164 ? "done" : "phone");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef(null);
  const recaptchaRef = useRef(null);

  async function sendCode() {
    setError("");
    const e164 = toE164(dial, national);
    if (!e164) {
      setError("Enter a valid country code and phone number.");
      return;
    }
    if (!isFirebaseConfigured()) {
      setError("Firebase phone env vars are not set. Add NEXT_PUBLIC_FIREBASE_* in Vercel and redeploy.");
      return;
    }
    setBusy(true);
    try {
      const auth = await getFirebaseAuth();
      if (!recaptchaRef.current) {
        recaptchaRef.current = new window.firebase.auth.RecaptchaVerifier("paw-phone-recaptcha", {
          size: "invisible",
        });
      }
      confirmRef.current = await auth.signInWithPhoneNumber(e164, recaptchaRef.current);
      setStep("code");
    } catch (err) {
      setError(err?.message || "Could not send SMS.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setError("");
    if (!confirmRef.current) {
      setError("Send a code first.");
      return;
    }
    setBusy(true);
    try {
      await confirmRef.current.confirm(code.trim());
      const e164 = toE164(dial, national);
      const res = await fetch("/api/sitter/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_e164: e164, phone_country_code: dial }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save verified phone.");
      try {
        await (await getFirebaseAuth()).signOut();
      } catch {
        /* keep Supabase session */
      }
      setStep("done");
      onVerified?.(e164);
    } catch (err) {
      setError(err?.message || "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
      <p className="text-sm font-semibold text-[#3b2a22]">Phone verification</p>
      <p className="mt-1 text-xs text-[#7a5c4e]">Required. We text a one-time code to this number.</p>
      <div id="paw-phone-recaptcha" />
      {step === "done" ? (
        <p className="mt-3 text-sm text-green-800">Verified {verifiedE164 || toE164(dial, national)}</p>
      ) : (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-[11rem_1fr]">
            <label className="text-xs text-[#7a5c4e]">
              Country code
              <select
                value={dial}
                onChange={(e) => setDial(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm text-[#3b2a22]"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.iso} value={c.dial}>
                    {c.name} +{c.dial}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[#7a5c4e]">
              Number
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="5551234567"
                value={national}
                onChange={(e) => setNational(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm text-[#3b2a22]"
              />
            </label>
          </div>
          {step === "code" ? (
            <label className="mt-2 block text-xs text-[#7a5c4e]">
              SMS code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm"
                placeholder="123456"
              />
            </label>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={step === "code" ? confirmCode : sendCode}
              className="rounded-full bg-[#c45c26] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Working…" : step === "code" ? "Confirm code" : "Text me a code"}
            </button>
            {step === "code" ? (
              <button type="button" disabled={busy} onClick={sendCode} className="text-xs font-semibold text-[#c45c26]">
                Resend
              </button>
            ) : null}
          </div>
        </>
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
