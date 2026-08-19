import { quoteBookingCustomerTotal } from "@/lib/pawServiceFee";

function moneyFromCents(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

function dollarsToCents(amount) {
  return Math.round((Number(amount) || 0) * 100);
}

export default function BookingPriceBreakdown({
  breakdown,
  showKeep = false,
  hideSitterRate = false,
  customerTotalLabel = "You pay:",
}) {
  if (!breakdown) return null;
  const unit = breakdown.unit_label || "visit";
  const units = Number(breakdown.units) || 0;
  const regularUnits = Math.max(0, units - (Number(breakdown.holiday_units) || 0));
  const rows = [];
  if (regularUnits > 0) {
    rows.push([`Base rate × ${regularUnits} ${unit}${regularUnits === 1 ? "" : "s"}`, breakdown.base]);
  }
  if (breakdown.holiday) {
    rows.push([`Holiday rate × ${breakdown.holiday_units || 0} ${unit}${(breakdown.holiday_units || 0) === 1 ? "" : "s"}`, breakdown.holiday]);
  }
  if ((breakdown.extra_pets || 0) > 0) {
    rows.push([`Additional pet × ${breakdown.extra_pets} × ${units} ${unit}${units === 1 ? "" : "s"}`, breakdown.extra_pet]);
  }
  if (breakdown.duration) {
    rows.push([`60-minute add-on × ${units}`, breakdown.duration]);
  }

  const quoted = quoteBookingCustomerTotal({
    subtotalCents: dollarsToCents(breakdown.total),
  });

  return (
    <div className="mt-2 rounded-xl border border-[#f0e0d2] bg-white px-3 py-2 text-xs text-[#5c4033]">
      {units === 0 ? <p className="text-[#7a5c4e]">Add dates and times to see the total.</p> : null}
      {rows.map(([label, amount]) => (
        <p key={label} className="flex justify-between gap-3">
          <span>{label}</span>
          <span>${Number(amount || 0).toFixed(2)}</span>
        </p>
      ))}
      {hideSitterRate ? null : (
        <p className="mt-1 flex justify-between gap-3 font-semibold text-[#3b2a22]">
          <span>Sitter rate</span>
          <span>${Number(breakdown.total || 0).toFixed(2)}</span>
        </p>
      )}
      {showKeep ? (
        <p className="flex justify-between gap-3 text-[#7a5c4e]">
          <span>You keep</span>
          <span>${Number(breakdown.sitter_keep || 0).toFixed(2)}</span>
        </p>
      ) : (
        <>
          <p className="mt-1 flex justify-between gap-3">
            <span>Paw Service Fee</span>
            <span>{moneyFromCents(quoted.feeCents)}</span>
          </p>
          <p className="mt-1 flex justify-between gap-3 font-semibold text-[#3b2a22]">
            <span>{customerTotalLabel}</span>
            <span>{moneyFromCents(quoted.customerPayCents)}</span>
          </p>
        </>
      )}
    </div>
  );
}
