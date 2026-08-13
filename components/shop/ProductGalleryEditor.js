"use client";

/** Shared gallery thumbs: first = cover */
export default function ProductGalleryEditor({ images = [], onChange, inputId = "gal-url" }) {
  const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

  function addFromInput() {
    const el = typeof document !== "undefined" ? document.getElementById(inputId) : null;
    const v = el?.value?.trim();
    if (!v) return;
    onChange([...(images || []), { url: v, alt_text: "", sort_order: (images || []).length }]);
    if (el) el.value = "";
  }

  function setCover(index) {
    if (index <= 0) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    onChange(next.map((m, i) => ({ ...m, sort_order: i })));
  }

  function removeAt(index) {
    onChange(images.filter((_, i) => i !== index).map((m, i) => ({ ...m, sort_order: i })));
  }

  return (
    <div className="rounded-xl border border-[#e8d5c4] bg-white p-3">
      <p className="text-sm font-semibold text-[#3b2a22]">Gallery</p>
      <p className="mt-0.5 text-xs text-[#7a5c4e]">
        First image is the <strong>cover</strong> (shop lists + PDP). Add URLs, then Set cover.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          className={inp + " flex-1"}
          placeholder="https://… image URL"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFromInput();
            }
          }}
        />
        <button
          type="button"
          className="rounded-full border border-[#e8d5c4] px-3 text-xs font-semibold"
          onClick={addFromInput}
        >
          Add
        </button>
      </div>
      {images.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {images.map((m, i) => (
            <li key={(m.url || "") + i} className="w-20">
              <div className="relative h-16 w-20 overflow-hidden rounded-lg border border-[#e8d5c4] bg-[#fff8f0]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="h-full w-full object-cover" />
                {i === 0 ? (
                  <span className="absolute bottom-0 left-0 right-0 bg-[#c45c26] text-center text-[9px] font-bold text-white">
                    COVER
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {i > 0 ? (
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-[#c45c26]"
                    onClick={() => setCover(i)}
                  >
                    Set cover
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-[10px] font-semibold text-red-600"
                  onClick={() => removeAt(i)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-[#7a5c4e]">No images yet.</p>
      )}
    </div>
  );
}
