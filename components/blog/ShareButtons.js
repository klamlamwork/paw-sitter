"use client";
import { useEffect, useMemo, useState } from "react";

export default function ShareButtons({ url, title }) {
  const [resolvedUrl, setResolvedUrl] = useState(url || "");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Prefer the live page URL so a bad NEXT_PUBLIC_SITE_URL cannot pollute shares.
    const clean = `${window.location.origin}${window.location.pathname}`;
    if (clean.startsWith("http")) setResolvedUrl(clean);
  }, []);

  const u = encodeURIComponent(resolvedUrl || "");
  const t = encodeURIComponent(title || "");
  const items = useMemo(
    () => [
      { name: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
      { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
      { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
      { name: "Email", href: `mailto:?subject=${t}&body=${encodeURIComponent(resolvedUrl || "")}` },
    ],
    [u, t, resolvedUrl]
  );

  async function copyLink() {
    const link = resolvedUrl || url || "";
    try {
      await navigator.clipboard.writeText(link);
      alert("Link copied");
    } catch {
      prompt("Copy link:", link);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#7a5c4e]">Share</span>
      {items.map((i) => (
        <a
          key={i.name}
          href={i.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-xs font-semibold text-[#5c4033] hover:bg-[#fff8f0]"
        >
          {i.name}
        </a>
      ))}
      <button
        type="button"
        onClick={copyLink}
        className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-xs font-semibold text-[#5c4033] hover:bg-[#fff8f0]"
      >
        Copy link
      </button>
    </div>
  );
}
