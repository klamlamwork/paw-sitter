"use client";
import { useEffect, useMemo, useRef, useState } from "react";

function ShareIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

function ChevronIcon({ open, className = "h-3 w-3" }) {
  return (
    <svg
      className={className + (open ? " rotate-180" : "")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function ShareButtons({ url, title }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState(url || "");
  const rootRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const clean = `${window.location.origin}${window.location.pathname}`;
    if (clean.startsWith("http")) setResolvedUrl(clean);
  }, []);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, []);

  const items = useMemo(() => {
    const u = encodeURIComponent(resolvedUrl || "");
    const t = encodeURIComponent(title || "");
    return [
      { name: "Post on X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, external: true },
      { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, external: true },
      { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, external: true },
      { name: "Email", href: `mailto:?subject=${t}&body=${encodeURIComponent(resolvedUrl || "")}`, external: false },
    ];
  }, [resolvedUrl, title]);

  async function copyLink() {
    const link = resolvedUrl || url || "";
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy link:", link);
    }
  }

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Share this post"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-sm font-semibold text-[#5c4033] shadow-sm hover:bg-[#fff8f0]"
      >
        <ShareIcon />
        <span>Share</span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-2 w-52 rounded-2xl border border-[#e8d5c4] bg-white p-1.5 shadow-lg"
        >
          {items.map((i) => (
            <a
              key={i.name}
              role="menuitem"
              href={i.href}
              target={i.external ? "_blank" : undefined}
              rel={i.external ? "noopener noreferrer" : undefined}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-sm font-medium text-[#3b2a22] hover:bg-[#fff8f0]"
            >
              {i.name}
            </a>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={copyLink}
            className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#3b2a22] hover:bg-[#fff8f0]"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
