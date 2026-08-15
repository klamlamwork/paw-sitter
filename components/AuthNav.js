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

function ProfileAvatar({ profile }) {
  const name = profile.full_name || profile.email || "A";
  const initial = String(name).trim().charAt(0).toUpperCase() || "A";
  const pic = profile.avatar_url || profile.photo_url || profile.profile_pic_url || "";
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#d6d6d6] bg-[#eeeeee] text-sm font-bold text-[#666666]">
      {pic ? <img src={pic} alt="" className="h-full w-full object-cover" /> : initial}
    </span>
  );
}

function SubMenu({ title, items, onNavigate }) {
  const [open, setOpen] = useState(false);
  if (!items?.length) return null;
  return (
    <div>
      <button type="button" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#3b2a22] hover:bg-[#fff8f0]" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="truncate">{title}</span>
        <span aria-hidden className="ml-2 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="mb-1 ml-2 border-l border-[#e8d5c4] pl-2">
          {items.map((l) => <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-[#5c4033] hover:bg-[#fff8f0]" onClick={onNavigate}>{l.label}</Link>)}
        </div>
      ) : null}
    </div>
  );
}

function DeskMenu({ title, items, open, setOpen, trigger }) {
  if (!items?.length) return null;
  return (
    <div className="relative">
      <button type="button" className="flex items-center text-sm font-medium text-[#5c4033] hover:text-[#c45c26]" onClick={() => setOpen()} aria-expanded={open} aria-label={typeof title === "string" ? title : "Account menu"}>
        {trigger || <span className="max-w-[10rem] truncate">{title} ▾</span>}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-[#e8d5c4] bg-white p-2 shadow-lg">
          {items.map((l) => <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#5c4033] hover:bg-[#fff8f0]" onClick={() => setOpen(false)}>{l.label}</Link>)}
        </div>
      ) : null}
    </div>
  );
}

export default function AuthNav({ profile }) {
  const [open, setOpen] = useState(false);
  const [desk, setDesk] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) { setOpen(false); setDesk(""); }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("touchstart", onDoc); };
  }, []);

  if (!profile) return <Link href="/login" className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a4519]">Log in</Link>;

  const isSitter = profile.role === "sitter" || profile.role === "admin";
  const sitterLinks = isSitter ? [
    { href: "/sitter/calendar", label: "Calendar" },
    { href: "/sitter/bookings", label: "Requests" },
    { href: "/sitter/dashboard", label: "Sitter Profile & Settings" },
  ] : [];
  const shopLinks = profile.hasShop ? [
    { href: "/account/shop", label: "Products" },
    { href: "/account/shop/orders", label: "Orders" },
  ] : [{ href: "/account/shop", label: "Open shop portal" }];
  const accountLinks = [
    { href: "/account", label: "Profile & bookings" },
    { href: "/shop/orders", label: "My shop orders" },
    { href: "/shop/cart", label: "Cart" },
  ];
  if (profile.role === "admin") accountLinks.push({ href: "/admin/sitters", label: "Admin sitters" });

  return (
    <div className="relative flex items-center gap-2" ref={rootRef}>
      <div className="hidden items-center gap-3 sm:flex">
        {isSitter ? <DeskMenu title="Sitter account" items={sitterLinks} open={desk === "sitter"} setOpen={() => setDesk((d) => (d === "sitter" ? "" : "sitter"))} /> : null}
        <DeskMenu title="Shop account" items={shopLinks} open={desk === "shop"} setOpen={() => setDesk((d) => (d === "shop" ? "" : "shop"))} />
        <DeskMenu title="Account" items={accountLinks} open={desk === "account"} setOpen={() => setDesk((d) => (d === "account" ? "" : "account"))} trigger={<ProfileAvatar profile={profile} />} />
        <form action="/auth/signout" method="post"><button type="submit" className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c4033]">Log out</button></form>
      </div>
      <div className="flex items-center sm:hidden">
        <button type="button" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((v) => !v)} className="mr-1"><ProfileAvatar profile={profile} /></button>
        <button type="button" aria-expanded={open} aria-label="More menu" onClick={() => setOpen((v) => !v)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e8d5c4] bg-white text-[#5c4033] shadow-sm active:bg-[#fff8f0]"><MoreIcon /></button>
        {open ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-[#e8d5c4] bg-white p-2 shadow-lg">
            <SubMenu title="Sitter account" items={sitterLinks} onNavigate={() => setOpen(false)} />
            <SubMenu title="Shop account" items={shopLinks} onNavigate={() => setOpen(false)} />
            <SubMenu title="Account" items={accountLinks} onNavigate={() => setOpen(false)} />
            <form action="/auth/signout" method="post" className="mt-1 border-t border-[#e8d5c4] pt-1"><button type="submit" className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#c45c26] hover:bg-[#fff8f0]">Log out</button></form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
