import Link from "next/link";

export default function InboxList({ conversations = [] }) {
  if (!conversations.length) {
    return <p className="mt-8 rounded-2xl border border-dashed border-[#e8d5c4] bg-white p-6 text-sm text-[#7a5c4e]">No conversations yet. They appear when a booking is requested.</p>;
  }
  return (
    <ul className="mt-6 divide-y divide-[#e8d5c4] overflow-hidden rounded-3xl border border-[#e8d5c4] bg-white">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link href={`/inbox/${c.id}`} className="flex gap-3 px-4 py-3 hover:bg-[#fff8f0]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fff1e6] text-sm font-bold text-[#c4a484]">
              {c.photo ? <img src={c.photo} alt="" className="h-full w-full object-cover" /> : (c.otherName || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-semibold text-[#3b2a22]">{c.otherName}</p>
                <span className="shrink-0 rounded-full bg-[#fff8f0] px-2 py-0.5 text-[11px] font-semibold capitalize text-[#5c4033]">{c.status}</span>
              </div>
              <p className="truncate text-sm text-[#5c4033]">{c.lastLine}</p>
              <p className="mt-0.5 truncate text-xs text-[#7a5c4e]">{c.serviceLine}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
