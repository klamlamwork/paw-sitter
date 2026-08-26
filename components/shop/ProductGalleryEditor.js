"use client";

import CloudinaryUploader from "@/components/media/CloudinaryUploader";

/** Product gallery. First image is cover. Uses Cloudinary public_id/version. */
export default function ProductGalleryEditor({ images = [], onChange, productId }) {
  function normalize(list) {
    return (list || []).map((item, index) => ({ ...item, sort_order: index }));
  }

  function addUploads(assets) {
    onChange(normalize([
      ...(images || []),
      ...assets.map((asset) => ({
        public_id: asset.public_id,
        version: asset.version,
        url: asset.preview_url, // preview only; DB stores IDs/version.
        alt_text: "",
      })),
    ]));
  }

  function setCover(index) {
    if (index <= 0) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    onChange(normalize(next));
  }

  function removeAt(index) {
    onChange(normalize(images.filter((_, i) => i !== index)));
  }

  return (
    <div className="rounded-xl border border-[#e8d5c4] bg-white p-3">
      <p className="text-sm font-semibold text-[#3b2a22]">Gallery</p>
      <p className="mt-0.5 text-xs text-[#7a5c4e]">Upload one or many images. The first image is the <strong>cover</strong>.</p>
      <div className="mt-3">
        <CloudinaryUploader kind="product" productId={productId} label="Upload gallery images" multiple onUploadedMany={addUploads} />
      </div>
      {images.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {images.map((m, i) => (
            <li key={(m.public_id || m.url || "image") + i} className="w-20">
              <div className="relative h-16 w-20 overflow-hidden rounded-lg border border-[#e8d5c4] bg-[#fff8f0]">
                {m.url ? <img src={m.url} alt="" className="h-full w-full object-cover" /> : null}
                {i === 0 ? <span className="absolute bottom-0 left-0 right-0 bg-[#c45c26] text-center text-[9px] font-bold text-white">COVER</span> : null}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {i > 0 ? <button type="button" className="text-[10px] font-semibold text-[#c45c26]" onClick={() => setCover(i)}>Set cover</button> : null}
                <button type="button" className="text-[10px] font-semibold text-red-600" onClick={() => removeAt(i)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-xs text-[#7a5c4e]">No images yet.</p>}
    </div>
  );
}
