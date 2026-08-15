export default function BookingPriceBreakdown({ breakdown, showKeep = false }) {
  if (!breakdown) return null;
  const rows = [
    breakdown.base ? ["Base rate", breakdown.base] : null,
    breakdown.holiday ? ["Holiday rate", breakdown.holiday] : null,
    breakdown.extra_pet ? [`Additional pet × ${breakdown.extra_pets || 0}`, breakdown.extra_pet] : null,
    breakdown.duration ? [Number(breakdown.duration_minutes) >= 60 ? "60-minute add-on" : "Duration add-on", breakdown.duration] : null,
  ].filter(Boolean);

  if (!rows.length && !breakdown.total) return null;

  return (
    <div className="mt-2 rounded-xl border border-[#f0e0d2] bg-white px-3 py-2 text-xs text-[#5c4033]">
      {rows.map(([label, amount]) => (
        <p key={label} className="flex justify-between gap-3">
          <span>{label}</span>
          <span>${Number(amount).toFixed(2)}</span>
        </p>
      ))}
      <p className="mt-1 flex justify-between gap-3 font-semibold text-[#3b2a22]">
        <span>Total</span>
        <span>${Number(breakdown.total || 0).toFixed(2)}</span>
      </p>
      {showKeep ? (
        <p className="flex justify-between gap-3 text-[#c45c26]">
          <span>You keep (90%)</span>
          <span>${Number(breakdown.sitter_keep || 0).toFixed(2)}</span>
        </p>
      ) : (
        <p className="flex justify-between gap-3 text-[#7a5c4e]">Platform fee 10% • Sitter 90%</p>
      )}
    </div>
  );
}
