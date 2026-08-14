"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function MoreIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function SubMenu({ title, items, onNavigate }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#3b2a22] hover:bg-[#fff8f0]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="truncate">{title}</span>
        <span aria-hidden className="ml-2 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="mb-1 ml-2 border-l border-[#e8d5c4] pl-2">
          {items.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-[#5c4033] hover:bg-[#fff8f0]"
              onClick={onNavigate}
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AuthNav({ profile }) {
  const [open, setOpen] = useState(false);
  const [deskSitter, setDeskSitter] = useState(false);
  const [deskAccount, setDeskAccount] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
        setDeskSitter(false);
        setDeskAccount(false);
      }
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
      <Link href="/login" className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a4519]">
        Log in
      </Link>
    );
  }

  const isSitter = profile.role === "sitter" || profile.role === "admin";
  const accountName = profile.full_name || "Account";

  const sitterLinks = [
    { href: "/sitter/calendar", label: "Calendar" },
    { href: "/sitter/bookings", label: "Requests" },
    { href: "/sitter/dashboard", label: "Sitter Profile & Settings" },
  ];

  const accountLinks = [
    { href: "/account", label: "Profile & bookings" },
    { href: "/shop/orders", label: "Shop orders" },
    { href: "/account/shop", label: "Shop portal" },
  ];
  if (profile.role === "admin") {
    accountLinks.push({ href: "/admin/sitters", label: "Admin sitters" });
  }

  const menuItemClass =
    "block rounded-lg px-3 py-2.5 text-sm font-medium text-[#5c4033] hover:bg-[#fff8f0]";
  const deskBtn = "max-w-[10rem] truncate text-sm font-medium text-[#5c4033] hover:text-[#c45c26]";

  return (
    <div className="relative flex items-center gap-2" ref={rootRef}>
      <div className="hidden items-center gap-3 sm:flex">
        {isSitter ? (
          <div className="relative">
            <button
              type="button"
              className={deskBtn}
              onClick={() => {
                setDeskSitter((v) => !v);
                setDeskAccount(false);
              }}
            >
              Sitter account ▾
            </button>
            {deskSitter ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-[#e8d5c4] bg-white p-2 shadow-lg">
                {sitterLinks.map((l) => (
                  <Link key={l.href} href={l.href} className={menuItemClass} onClick={() => setDeskSitter(false)}>
                    {l.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="relative">
          <button
            type="button"
            className={deskBtn}
            onClick={() => {
              setDeskAccount((v) => !v);
              setDeskSitter(false);
            }}
          >
            {accountName} ▾
          </button>
          {deskAccount ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-[#e8d5c4] bg-white p-2 shadow-lg">
              {accountLinks.map((l) => (
                <Link key={l.href} href={l.href} className={menuItemClass} onClick={() => setDeskAccount(false)}>
                  {l.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c4033]"
          >
            Log out
          </button>
        </form>
      </div>

      <div className="flex items-center sm:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-label="More menu"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e8d5c4] bg-white text-[#5c4033] shadow-sm active:bg-[#fff8f0]"
        >
          <MoreIcon />
        </button>
        {open ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-[#e8d5c4] bg-white p-2 shadow-lg">
            {isSitter ? (
              <SubMenu title="Sitter account" items={sitterLinks} onNavigate={() => setOpen(false)} />
            ) : null}
            <SubMenu title={accountName} items={accountLinks} onNavigate={() => setOpen(false)} />
            <form action="/auth/signout" method="post" className="mt-1 border-t border-[#e8d5c4] pt-1">
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#c45c26] hover:bg-[#fff8f0]"
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
