"use client";

import { useCallback, useEffect, useState } from "react";
import ProductModalBody from "./ProductModalBody";

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
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Product details">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close product" onClick={close} />
      <div className="relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#fff8f0] shadow-2xl sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e8d5c4] bg-[#fff8f0]/95 px-4 py-3 backdrop-blur">
          <p className="text-sm font-semibold text-[#3b2a22]">Product</p>
          <button
            type="button"
            onClick={close}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-bold text-[#3b2a22] ring-1 ring-[#e8d5c4]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <ProductModalBody slug={slug} />
        </div>
      </div>
    </div>
  );
}
