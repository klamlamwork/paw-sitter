"use client";

/**
 * Controlled brand/tag fields for the product create/edit form.
 * Does not write shop_products.brand_name or shop_product_tags.
 * Approved products keep live brand/tags until admin approves a pending snapshot.
 */
export default function ProductBrandTagsEditor({
  brandName = "",
  tagIds = [],
  tags = [],
  onChange,
  disabled = false,
  pending = false,
}) {
  const selected = new Set(tagIds || []);

  function emit(patch) {
    onChange?.({
      brandName,
      tagIds: [...selected],
      ...patch,
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-[#e8d5c4] bg-white p-3">
      <p className="text-sm font-semibold text-[#3b2a22]">Brand & tags</p>
      <p className="text-xs text-[#7a5c4e]">
        {pending
          ? "These values are in the approval request. The public page keeps the last approved brand and tags."
          : "Saved with the product. If the product is already live, this waits for admin approval like name, price, and gallery."}
      </p>
      <label className="block text-xs">
        Brand name
        <input
          className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1 text-sm"
          value={brandName || ""}
          disabled={disabled}
          placeholder="Brand name"
          onChange={(e) => emit({ brandName: e.target.value })}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {(tags || []).map((tag) => {
          const on = selected.has(tag.id);
          return (
            <label key={tag.id} className="inline-flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                disabled={disabled}
                checked={on}
                onChange={() => {
                  const next = new Set(selected);
                  if (next.has(tag.id)) next.delete(tag.id);
                  else next.add(tag.id);
                  emit({ tagIds: [...next] });
                }}
              />
              {tag.name}
            </label>
          );
        })}
      </div>
      {!(tags || []).length ? (
        <p className="text-xs text-[#7a5c4e]">No tags yet. Ask an admin to add controlled shop tags.</p>
      ) : null}
    </div>
  );
}
