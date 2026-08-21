
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
  return <span className="inline-flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-[#d6d6d6] bg-[#eeeeee] text-sm font-bold text-[#403f3f] avatar-initial">{initial}</span>;
}

function SubMenu({ title, items, onNavigate }) {
  const [open, setOpen] = useState(false);
  if (!items?.length) return null;
  return (
    <div>
      <button type="button" className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#3d2a14] hover:bg-[#fff9ed]" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="truncate">{title}</span><span aria-hidden className="ml-2 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open ? <div className="mb-1 ml-2 border-l border-[#efd09a] pl-2">{items.map((l) => <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]" onClick={onNavigate}>{l.label}</Link>)}</div> : null}
    </div>
  );
}

function DeskMenu({ title, items, open, setOpen, trigger }) {
  if (!items?.length) return null;
  return (
    <div className="relative">
      <button type="button" className="flex cursor-pointer items-center text-sm font-medium text-[#5a4018] hover:text-[#e39b2e]" onClick={() => setOpen()} aria-expanded={open} aria-label={typeof title === "string" ? title : "Account menu"}>{trigger || <span className="max-w-[10rem] truncate">{title} ▾</span>}</button>
      {open ? <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-[#efd09a] bg-white p-2 shadow-lg">{items.map((l) => <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]" onClick={() => setOpen(false)}>{l.label}</Link>)}</div> : null}
    </div>
  );
}

export default function AuthNav({ profile }) {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [desk, setDesk] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) { setAvatarOpen(false); setMoreOpen(false); setDesk(""); }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("touchstart", onDoc); };
  }, []);

  if (!profile) {
    return (
      <div className="relative flex items-center gap-2" ref={rootRef}>
        <Link href="/login" className="rounded-full bg-[#e39b2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c47a18]">Log in</Link>
        <div className="relative sm:hidden">
          <button type="button" aria-expanded={moreOpen} aria-label="More menu" onClick={() => { setMoreOpen((v) => !v); setAvatarOpen(false); }} className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#efd09a] bg-white text-[#5a4018] shadow-sm active:bg-[#fff9ed]"><MoreIcon /></button>
          {moreOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-[#efd09a] bg-white p-2 shadow-lg">
              <Link href="/shop" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]" onClick={() => setMoreOpen(false)}>Shop</Link>
              <Link href="/booking" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]" onClick={() => setMoreOpen(false)}>Book Services</Link>
              <Link href="/sitters" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]" onClick={() => setMoreOpen(false)}>Sitters</Link>
              <Link href="/blog" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]" onClick={() => setMoreOpen(false)}>Blog</Link>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const isSitter = profile.role === "sitter" || profile.role === "admin";
  const sitterLinks = isSitter ? [
    { href: "/sitter/bookings", label: "Requests" },
    { href: "/sitter/calendar", label: "Calendar" },
    { href: "/sitter/dashboard", label: "Sitter Profile & Settings" },
  ] : [];
  const shopLinks = profile.hasShop ? [
    { href: "/account/shop", label: "Products" },
    { href: "/account/shop/orders", label: "Orders" },
  ] : [{ href: "/account/shop", label: "Open shop portal" }];
  const accountLinks = [
    { href: "/account", label: "Profile & Bookings" },
    { href: "/shop/orders", label: "My Purchase Orders" },
    { href: "/shop/cart", label: "Cart" },
    { href: "/account/paw-points", label: "My PawPoints" },

  ];
  if (profile.role === "admin") accountLinks.push({ href: "/admin/sitters", label: "Admin sitters" });

  return (
    <div className="relative flex items-center gap-2" ref={rootRef}>
      <div className="hidden items-center gap-3 sm:flex">
        {isSitter ? <DeskMenu title="Sitter account" items={sitterLinks} open={desk === "sitter"} setOpen={() => setDesk((d) => (d === "sitter" ? "" : "sitter"))} /> : null}
        <DeskMenu title="Shop account" items={shopLinks} open={desk === "shop"} setOpen={() => setDesk((d) => (d === "shop" ? "" : "shop"))} />
        <DeskMenu title="Account" items={accountLinks} open={desk === "account"} setOpen={() => setDesk((d) => (d === "account" ? "" : "account"))} trigger={<ProfileAvatar profile={profile} />} />
        <form action="/auth/signout" method="post"><button type="submit" className="cursor-pointer rounded-full border border-[#efd09a] bg-white px-3 py-1.5 text-xs font-semibold text-[#5a4018]">Log out</button></form>
      </div>

      <div className="flex items-center gap-1 sm:hidden">
        <div className="relative">
          <button type="button" aria-expanded={avatarOpen} aria-label="Account menu" onClick={() => { setAvatarOpen((v) => !v); setMoreOpen(false); }} className="cursor-pointer"><ProfileAvatar profile={profile} /></button>
          {avatarOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-[#efd09a] bg-white p-2 shadow-lg">
              <SubMenu title="Account" items={accountLinks} onNavigate={() => setAvatarOpen(false)} />
              <SubMenu title="Sitter account" items={sitterLinks} onNavigate={() => setAvatarOpen(false)} />
              <SubMenu title="Shop account" items={shopLinks} onNavigate={() => setAvatarOpen(false)} />
              <form action="/auth/signout" method="post" className="mt-1 border-t border-[#efd09a] pt-1"><button type="submit" className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#e39b2e] hover:bg-[#fff9ed]">Log out</button></form>
            </div>
          ) : null}
        </div>
        <div className="relative">
          <button type="button" aria-expanded={moreOpen} aria-label="More menu" onClick={() => { setMoreOpen((v) => !v); setAvatarOpen(false); }} className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#efd09a] bg-white text-[#5a4018] shadow-sm active:bg-[#fff9ed]"><MoreIcon /></button>
          {moreOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-[#efd09a] bg-white p-2 shadow-lg">
              <Link href="/shop" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]" onClick={() => setMoreOpen(false)}>Shop</Link>
              <Link href="/booking" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]" onClick={() => setMoreOpen(false)}>Book Services</Link>
              <Link href="/sitters" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]" onClick={() => setMoreOpen(false)}>Sitters</Link>
              <Link href="/blog" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#5a4018] hover:bg-[#fff9ed]" onClick={() => setMoreOpen(false)}>Blog</Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
