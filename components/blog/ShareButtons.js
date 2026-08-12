"use client";
export default function ShareButtons({ url, title }) {
  const encodedUrl = encodeURIComponent(url || "");
  const encodedTitle = encodeURIComponent(title || "");
  const items = [
    { name: "X", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { name: "Email", href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}` },
  ];
  async function copyLink() {
    try { await navigator.clipboard.writeText(url); alert("Link copied"); }
    catch { prompt("Copy link:", url); }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#7a5c4e]">Share</span>
      {items.map((i) => (
        <a key={i.name} href={i.href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-xs font-semibold text-[#5c4033] hover:bg-[#fff8f0]">{i.name}</a>
      ))}
      <button type="button" onClick={copyLink} className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1 text-xs font-semibold text-[#5c4033] hover:bg-[#fff8f0]">Copy link</button>
    </div>
  );
}
