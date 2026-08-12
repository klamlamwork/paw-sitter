"use client";
export default function RelatedProducts({ products }) {
  if (!products?.length) return null;
  const card = (p) => (
    <a key={p.id} href={p.url || "#"} target="_blank" rel="noopener noreferrer" className="flex min-w-[220px] max-w-[260px] shrink-0 gap-3 rounded-2xl border border-[#e8d5c4] bg-white p-3 shadow-sm hover:border-[#c45c26]/50 lg:max-w-none lg:min-w-0">
      {p.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#fff8f0] text-xs text-[#7a5c4e]">Product</div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#3b2a22]">{p.title}</p>
        {p.description ? <p className="mt-0.5 line-clamp-2 text-xs text-[#7a5c4e]">{p.description}</p> : null}
      </div>
    </a>
  );
  return (
    <>
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/80 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#7a5c4e]">Related products</h2>
          <div className="mt-3 space-y-3">{products.map(card)}</div>
        </div>
      </aside>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8d5c4] bg-[#fff8f0]/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#7a5c4e]">Related products</p>
        <div className="flex gap-3 overflow-x-auto pb-1">{products.map(card)}</div>
      </div>
    </>
  );
}
