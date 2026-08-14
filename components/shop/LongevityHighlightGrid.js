import { longevityIconEmoji } from "@/lib/shop";

export default function LongevityHighlightGrid({ items = [] }) {
  if (!items.length) return null;
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-[#3b2a22]">Longevity highlights</h2>
      <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map((it) => {
          const src = it.icon_url || (/^https?:\/\//i.test(it.icon_key || "") ? it.icon_key : "");
          return (
            <li
              key={it.id || it.highlight_id || it.label}
              className="flex flex-col items-center rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/80 px-2 py-3 text-center"
              title={it.note || it.label}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-14 w-14 rounded-full object-cover shadow-sm ring-1 ring-[#e8d5c4]" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-[#e8d5c4]">
                  {longevityIconEmoji(it.icon_key)}
                </span>
              )}
              <span className="mt-2 text-xs font-semibold leading-snug text-[#3b2a22]">{it.label}</span>
              {it.note ? <span className="mt-0.5 line-clamp-2 text-[10px] text-[#7a5c4e]">{it.note}</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
