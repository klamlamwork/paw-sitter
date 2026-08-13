"use client";

function QtyStepper({ qty, max = 99, onChange }) {
  const cap = Math.max(1, Math.min(99, max || 99));
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-[#5c4033]">Qty</span>
      <button
        type="button"
        className="h-9 w-9 rounded-full border border-[#e8d5c4] text-lg leading-none"
        onClick={() => onChange(Math.max(1, qty - 1))}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        min={1}
        max={cap}
        value={qty}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isFinite(n)) return;
          onChange(Math.min(cap, Math.max(1, n)));
        }}
        className="h-9 w-14 rounded-xl border border-[#e8d5c4] text-center text-sm font-semibold"
      />
      <button
        type="button"
        className="h-9 w-9 rounded-full border border-[#e8d5c4] text-lg leading-none"
        onClick={() => onChange(Math.min(cap, qty + 1))}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

export default function QtyStepperExport(props) {
  return <QtyStepper {...props} />;
}
