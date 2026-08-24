"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginClient() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const err = searchParams.get("error");
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState(err ? "Login failed. Try again." : "");
  const [success, setSuccess] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);

  function callbackUrl(pathNext) {
    const origin = window.location.origin;
    return origin + "/auth/callback?next=" + encodeURIComponent(pathNext || next);
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setMessage("");
    setSuccess("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setMessage(error.message);
      setGoogleLoading(false);
    }
  }

  async function onEmailSubmit(e) {
    e.preventDefault();
    setMessage("");
    setSuccess("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: trimmed,
          password,
          options: { emailRedirectTo: callbackUrl() },
        });
        if (error) throw error;
        if (data.session) {
          window.location.href = next.startsWith("/") ? next : "/";
          return;
        }
        const existing = !data.user?.identities?.length;
        if (existing) {
          const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
            redirectTo: callbackUrl("/login/update-password"),
          });
          if (resetErr) throw resetErr;
          setNeedsVerify(false);
          setSuccess("An account already exists for this email. We've sent a password setup link to your inbox so you can log in with a password going forward.");
          return;
        }
        setNeedsVerify(true);
        setSuccess("Check your email and click the verification link to finish creating your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (error) {
          if (/confirm|verif/i.test(error.message)) {
            setNeedsVerify(true);
            throw new Error("Please verify your email first. Check your inbox for the link.");
          }
          throw error;
        }
        window.location.href = next.startsWith("/") ? next : "/";
        return;
      }
    } catch (ex) {
      setMessage(ex.message || "Could not continue with email.");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setMessage("Enter your email first.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmed,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) throw error;
      setSuccess("Verification email sent again. Check your inbox.");
    } catch (ex) {
      setMessage(ex.message || "Could not resend verification email.");
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setMessage("Enter your email first, then tap Forgot password.");
      return;
    }
    setLoading(true);
    setMessage("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: callbackUrl("/login/update-password"),
      });
      if (error) throw error;
      setSuccess("If that email has an account, we sent a password reset link.");
    } catch (ex) {
      setMessage(ex.message || "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <div className="w-full rounded-3xl border border-[#e8d5c4] bg-[#fff8f0]/95 p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo.svg" alt="Paw Sitter" width={64} height={64} className="h-16 w-16" />
          <h1 className="mt-4 text-2xl font-bold text-[#3b2a22]">Welcome to Paw Sitter</h1>
          <p className="mt-2 text-sm text-[#7a5c4e]">Sign in with email or Google to book or manage sitting.</p>
        </div>

        {message ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700">{message}</p> : null}
        {success ? <p className="mb-4 rounded-xl bg-green-50 px-3 py-2 text-center text-sm text-green-800">{success}</p> : null}

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-white p-1">
          <button type="button" onClick={() => { setMode("signin"); setMessage(""); setSuccess(""); }} className={"rounded-full px-3 py-2 text-sm font-semibold " + (mode === "signin" ? "bg-[#c45c26] text-white" : "text-[#5c4033]")}>
            Sign in
          </button>
          <button type="button" onClick={() => { setMode("signup"); setMessage(""); setSuccess(""); }} className={"rounded-full px-3 py-2 text-sm font-semibold " + (mode === "signup" ? "bg-[#c45c26] text-white" : "text-[#5c4033]")}>
            Create account
          </button>
        </div>

        <form className="space-y-3" onSubmit={onEmailSubmit}>
          <label className="block text-sm">
            <span className="font-medium text-[#3b2a22]">Email</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#3b2a22]">Password</span>
            <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
          </label>
          {mode === "signup" ? (
            <label className="block text-sm">
              <span className="font-medium text-[#3b2a22]">Confirm password</span>
              <input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" />
            </label>
          ) : null}
          {mode === "signin" ? (
            <button type="button" onClick={forgotPassword} disabled={loading} className="text-xs font-semibold text-[#c45c26] hover:underline disabled:opacity-60">
              Forgot password?
            </button>
          ) : null}
          <button type="submit" disabled={loading || googleLoading} className="flex w-full items-center justify-center rounded-full bg-[#c45c26] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Working…" : mode === "signup" ? "Create account" : "Sign in with email"}
          </button>
        </form>

        {needsVerify ? (
          <button type="button" onClick={resendVerification} disabled={loading} className="mt-2 w-full text-center text-xs font-semibold text-[#c45c26] hover:underline disabled:opacity-60">
            Resend verification email
          </button>
        ) : null}

        <div className="my-5 flex items-center gap-3 text-xs text-[#7a5c4e]">
          <span className="h-px flex-1 bg-[#e8d5c4]" />
          or continue with
          <span className="h-px flex-1 bg-[#e8d5c4]" />
        </div>

        <button type="button" onClick={signInWithGoogle} disabled={loading || googleLoading} className="flex w-full items-center justify-center rounded-full border border-[#e8d5c4] bg-white px-4 py-3 text-sm font-semibold text-[#3b2a22] disabled:opacity-60">
          {googleLoading ? "Redirecting..." : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}
