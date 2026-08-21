"use client";

import { useEffect, useState } from "react";

export default function ReferralInviteCard() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals/me")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: true }));
  }, []);

  if (!data || data.error) return null;
  const link = data.link || "";
  const points = data.points || 5000;
  const text = `Join Paw Sitter with my link and we each get ${points} Paw Points after your first completed booking or purchase: ${link}`;
  const waHref = "https://wa.me/?text=" + encodeURIComponent(text);
  const mailHref = "mailto:?subject=" + encodeURIComponent("Join Paw Sitter") + "&body=" + encodeURIComponent(text);
  const smsHref = "sms:?body=" + encodeURIComponent(text);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-5">
      <h2 className="text-lg font-semibold text-[#3b2a22]">Invite friends</h2>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Share your link. When a new user completes their first booking or purchase, you both get {points} Paw Points.
      </p>
      <p className="mt-3 break-all rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm">{link}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="rounded-full bg-[#c45c26] px-4 py-2 text-xs font-semibold text-white">
          {copied ? "Copied" : "Copy link"}
        </button>
        <a className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-xs font-semibold" href={waHref} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-xs font-semibold" href={mailHref}>Email</a>
        <a className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-xs font-semibold" href={smsHref}>SMS</a>
      </div>
    </div>
  );
}
