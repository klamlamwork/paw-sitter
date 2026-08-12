"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function AuthNav({ profile }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

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

  if (!profile) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a4519]"
      >
        Log in
      </Link>
    );
  }

  const links = [];
  if (profile.role === "admin") {
    links.push({ href: "/admin/sitters", label: "Admin" });
  }
  if (profile.role === "sitter" || profile.role === "admin") {
    links.push({ href: "/sitter/calendar", label: "Calendar" });
    links.push({ href: "/sitter/dashboard", label: "Sitter" });
    links.push({ href: "/sitter/bookings", label: "Requests" });
  }
  links.push({
    href: "/account",
    label: profile.full_name || "Account",
  });

  const linkClass =
    "block rounded-lg px-3 py-2 text-sm font-medium text-[#5c4033] hover:bg-[#fff8f0]";
  const deskLinkClass =
    "text-sm font-medium text-[#5c4033] hover:text-[#c45c26]";

  return (
    <div className="relative flex items-center gap-2" ref={rootRef}>
      <div className="hidden items-center gap-3 sm:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={deskLinkClass}>
            {l.label}
          </Link>
        ))}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c4033]"
          >
            Log out
          </button>
        </form>
      </div>

      <div className="flex items-center gap-2 sm:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-label="Open menu"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-[#e8d5c4] bg-white px-3 py-2 text-xs font-semibold text-[#5c4033]"
        >
          Menu
          <span aria-hidden>{open ? "▲" : "▼"}</span>
        </button>
        {open ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-[#e8d5c4] bg-white p-2 shadow-lg">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <form action="/auth/signout" method="post" className="mt-1 border-t border-[#e8d5c4] pt-1">
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#c45c26] hover:bg-[#fff8f0]"
              >
                Log out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
