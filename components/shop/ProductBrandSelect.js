"use client";

export default function ProductBrandSelect({ brands = [], value = "", onChange, className }) {
  return (
    <label className="block text-sm font-medium">
      Brand
      <select
        className={className}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
      >
        <option value="">— no brand —</option>
        {(brands || []).map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-[11px] font-normal text-[#7a5c4e]">
        Choose from Admin → Shop → Brands. This does not change tags.
      </span>
    </label>
  );
}
