"use client";

import { useCallback, useEffect, useState } from "react";

function slugFromHref(href) {
  try {
    const url = new URL(href, window.location.origin);
    const match = url.pathname.match(/^\/shop\/p\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

export default function ProductModalHost() {
  const [slug, setSlug] = useState("");

  const close = useCallback(() => {
    setSlug("");
    document.body.style.overflow = "";
    if (window.history.state?.productModal) {
      window.history.back();
    }
  }, []);

  const open = useCallback((nextSlug) => {
    if (!nextSlug) return;
    setSlug(nextSlug);
    document.body.style.overflow = "hidden";
    if (!window.history.state?.productModal) {
      window.history.pushState({ productModal: nextSlug }, "", window.location.href);
    }
  }, []);

  useEffect(() => {
    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (window.location.pathname.startsWith("/shop/p/")) return;
      if (new URLSearchParams(window.location.search).get("embed") === "1") return;
      const a = e.target.closest?.("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.dataset.fullPage === "1") return;
      const next = slugFromHref(a.getAttribute("href") || "");
      if (!next) return;
      e.preventDefault();
      e.stopPropagation();
      open(next);
    }
    function onPop() {
      if (window.history.state?.productModal) {
        setSlug(window.history.state.productModal);
        document.body.style.overflow = "hidden";
      } else {
        setSlug("");
        document.body.style.overflow = "";
      }
    }
    function onKey(e) {
      if (e.key === "Escape" && slug) close();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, slug]);

  if (!slug) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-3" role="dialog" aria-modal="true" aria-label="Product details">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close product" onClick={close} />
      <div className="relative flex h-[95dvh] w-[95vw] max-w-[95vw] flex-col overflow-hidden rounded-2xl bg-[#fff8f0] shadow-2xl">
        <div className="absolute right-2 top-2 z-20 sm:right-3 sm:top-3">
          <button
            type="button"
            onClick={close}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-bold leading-none text-[#3b2a22] shadow-md ring-1 ring-[#e8d5c4]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <iframe
          title="Product details"
          src={`/shop/p/${encodeURIComponent(slug)}?embed=1`}
          className="h-full w-full border-0 bg-[#fff8f0]"
        />
      </div>
    </div>
  );
}
