"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AuthNav from "./AuthNav";

function BarsIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" />
    </svg>
  );
}

function XIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

export default function Header({ profile }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("touchstart", onDoc); };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-[#efd09a] bg-white" ref={rootRef}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Paw Sitter" className="h-8 w-auto" />
          <span className="text-lg font-bold text-[#5a4018]">Paw Sitter</span>
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-6 sm:flex">
          <Link href="/shop" className="text-sm font-medium text-[#5a4018] hover:text-[#e39b2e]">Shop</Link>
          <Link href="/sitters" className="text-sm font-medium text-[#5a4018] hover:text-[#e39b2e]">Sitters</Link>
          <Link href="/blog" className="text-sm font-medium text-[#5a4018] hover:text-[#e39b2e]">Blog</Link>
          {profile ? (
            <>
              <Link href="/inbox" className="text-sm font-medium text-[#5a4018] hover:text-[#e39b2e]">Inbox</Link>
              <AuthNav profile={profile} />
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-[#e39b2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c47a18]">Log in</Link>
          )}
        </nav>

        {/* Mobile */}
        <div className="flex items-center gap-2 sm:hidden">
          {profile ? (
            <Link href="/inbox" className="rounded-full border border-[#efd09a] bg-white px-3 py-1.5 text-sm font-semibold text-[#5a4018]">Inbox</Link>
          ) : null}
          <button type="button" aria-expanded={open} aria-label="Toggle menu" onClick={() => setOpen((v) => !v)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#efd09a] bg-white text-[#5a4018] shadow-sm active:bg-[#fff9ed]">
            {open ? <XIcon /> : <BarsIcon />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="border-t border-[#efd09a] bg-white px-4 pb-4 sm:hidden">
          <nav className="flex flex-col gap-2">
            <Link href="/shop" className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]">Shop</Link>
            <Link href="/sitters" className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]">Sitters</Link>
            <Link href="/blog" className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]">Blog</Link>
            {profile ? (
              <>
                <Link href="/inbox" className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]">Inbox</Link>
                <AuthNav profile={profile} />
              </>
            ) : (
              <Link href="/login" className="rounded-full bg-[#e39b2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c47a18]">Log in</Link>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
