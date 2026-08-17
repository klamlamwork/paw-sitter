export function toCents(amount) {
  const n = Number(amount) || 0;
  return Number.isInteger(n) && Math.abs(n) >= 50 ? n : Math.round(n * 100);
}

function serviceGroup(type) {
  const t = String(type || "").toLowerCase();
  if (["house_sit", "housesit", "house-sit", "boarding"].includes(t)) return "overnight";
  if (["drop_in", "drop-in", "dropin"].includes(t)) return "drop_in";
  if (["dog_walking", "dog_walk", "walking", "daycare", "doggie_daycare", "doggie-day-care", "dog_daycare"].includes(t)) return "session";
  return "overnight";
}

function dateKey(iso, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function explodeUnits(booking) {
  const group = serviceGroup(booking.service_type);
  const tz = booking.booked_timezone || "UTC";
  const slots = [...(booking.booking_slots || [])].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const units = [];

  if (group === "overnight") {
    if (!slots.length) return units;
    const start = new Date(slots[0].starts_at);
    const end = new Date(slots[slots.length - 1].ends_at || slots[slots.length - 1].starts_at);
    const longRange = slots.length === 1 || (end - start) / 36e5 > 20;
    if (longRange) {
      const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
      if (last <= cursor) last.setUTCDate(last.getUTCDate() + 1);
      while (cursor < last) {
        const starts = cursor.toISOString();
        const next = new Date(cursor);
        next.setUTCDate(next.getUTCDate() + 1);
        units.push({ kind: "night", starts_at: starts, ends_at: next.toISOString(), date: dateKey(starts, tz) });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    } else {
      for (const slot of slots) {
        units.push({
          kind: "night",
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          date: dateKey(slot.starts_at, tz),
        });
      }
    }
    return units;
  }

  for (const slot of slots) {
    units.push({
      kind: group === "session" ? "session" : "visit",
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      date: dateKey(slot.starts_at, tz),
    });
  }
  return units;
}

function splitEven(total, count) {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i === count - 1 ? extra : 0));
}

export function quoteBookingRefund(booking, { actor = "owner", waiveRemaining = false, now = new Date() } = {}) {
  const group = serviceGroup(booking.service_type);
  const units = explodeUnits(booking);
  const gross = Math.max(0, toCents(booking.estimated_total));
  const addon = Math.max(0, toCents(booking.addon_cents));
  const serviceGross = Math.max(0, gross - addon);
  const nowMs = new Date(now).getTime();

  const completed = [];
  const remaining = [];
  for (const unit of units) {
    if (new Date(unit.starts_at).getTime() <= nowMs) completed.push(unit);
    else remaining.push(unit);
  }

  const amounts = splitEven(serviceGross, units.length || 1);
  units.forEach((unit, i) => {
    unit.cents = units.length ? amounts[i] : serviceGross;
  });

  const fullRemaining = actor === "sitter" || waiveRemaining;
  let refundService = 0;
  let retainedService = 0;
  const lines = [];

  for (const unit of completed) {
    retainedService += unit.cents;
    lines.push({ ...unit, refund_cents: 0, retained_cents: unit.cents, rule: "completed_nonrefundable" });
  }

  if (group === "session" || fullRemaining) {
    for (const unit of remaining) {
      refundService += unit.cents;
      lines.push({
        ...unit,
        refund_cents: unit.cents,
        retained_cents: 0,
        rule: fullRemaining ? "remaining_full_refund" : "session_full_refund_before_start",
      });
    }
  } else {
    const remainingDays = [...new Set(remaining.map((u) => u.date))].sort();
    const halfDays = new Set(remainingDays.slice(0, 7));
    for (const unit of remaining) {
      const half = halfDays.has(unit.date);
      const refund = half ? Math.round(unit.cents * 0.5) : unit.cents;
      refundService += refund;
      retainedService += unit.cents - refund;
      lines.push({
        ...unit,
        refund_cents: refund,
        retained_cents: unit.cents - refund,
        rule: half ? "first_7_remaining_days_50" : "beyond_7_remaining_days_100",
      });
    }
  }

  if (!units.length) {
    if (fullRemaining || group === "session") refundService = serviceGross;
    else {
      refundService = Math.round(serviceGross * 0.5);
      retainedService = serviceGross - refundService;
    }
    lines.push({
      kind: "unscheduled",
      refund_cents: refundService,
      retained_cents: retainedService,
      rule: "fallback_no_slots",
    });
  }

  const unusedAddon = remaining.length || !units.length ? addon : 0;
  const usedAddon = addon - unusedAddon;
  const refundCents = refundService + unusedAddon;
  const retainedCents = Math.max(0, gross - refundCents);

  return {
    group,
    actor,
    waived: !!waiveRemaining,
    completed_units: completed.length,
    remaining_units: remaining.length,
    refund_cents: refundCents,
    retained_cents: retainedCents,
    addon_refund_cents: unusedAddon,
    addon_retained_cents: usedAddon,
    lines,
    summary:
      actor === "sitter"
        ? "Sitter canceled. Completed time is kept; all unrendered time and unused add-ons are refunded in full."
        : waiveRemaining
        ? "Sitter waived the policy. Completed time is kept; remaining time and unused add-ons are refunded in full."
        : group === "session"
        ? "Walks and daycare: completed sessions are kept. Any session that has not started is refunded in full."
        : "Completed days are kept. The first 7 remaining days refund 50%. Days after that refund 100%. Unused add-ons refund 100%.",
  };
}
