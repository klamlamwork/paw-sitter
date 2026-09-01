"use client";

/** Tag picker only. Brand is chosen with ProductBrandSelect (brand_shop_id). */
export default function ProductBrandTagsEditor({
  brandName = "",
  tagIds = [],
  tags = [],
  onChange,
  disabled = false,
  pending = false,
}) {
  const selected = new Set(tagIds || []);

  function emit(tagIdsNext) {
    onChange?.({
      brandName,
      tagIds: tagIdsNext,
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-[#e8d5c4] bg-white p-3">
      <p className="text-sm font-semibold text-[#3b2a22]">Tags</p>
      <p className="text-xs text-[#7a5c4e]">
        {pending
          ? "These tags are in the approval request. The public page keeps the last approved tags."
          : "Saved with the product. If the product is already live, tags wait for admin approval."}
      </p>
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
                  emit([...next]);
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
