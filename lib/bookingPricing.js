export function keep90(amount) {
  return Math.round((Number(amount) || 0) * 90) / 100;
}

export function extraPetsFromCount(petCount) {
  return Math.max(0, (Number(petCount) || 0) - 1);
}

export function dateKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function normalizeServiceType(type) {
  if (type === "dog_walking") return "walking";
  return type;
}

export function isOvernightService(type) {
  const t = normalizeServiceType(type);
  return t === "house_sit" || t === "boarding";
}

export function estimateBookingPrice({
  serviceType,
  dates = [],
  visitCount,
  durationMinutes,
  petCount = 0,
  rateRegular = 0,
  rateHoliday = 0,
  extraPetRate = 0,
  rate60 = 0,
  holidaySet = new Set(),
}) {
  const extraPets = extraPetsFromCount(petCount);
  const extraPet = Number(extraPetRate) || 0;
  const add60 = Number(rate60) || 0;
  const overnight = isOvernightService(serviceType);
  const units = (dates || []).map((d) => new Date(d.date || d));

  let base = 0;
  let holiday = 0;
  let extra = 0;
  let duration = 0;
  let unitCount = 0;

  if (overnight) {
    const nights = units.length >= 2 ? units.length - 1 : units.length;
    const nightDates = units.slice(0, Math.max(nights, 0));
    for (const d of nightDates) {
      const isHol = holidaySet.has(dateKey(d));
      const r = Number(isHol ? rateHoliday : rateRegular) || 0;
      if (isHol) holiday += r;
      else base += r;
      extra += extraPets * extraPet;
      unitCount += 1;
    }
  } else {
    const count = Number(visitCount) || units.length || 0;
    for (let i = 0; i < count; i++) {
      const d = units[i] || units[0] || new Date();
      const isHol = holidaySet.has(dateKey(d));
      const r = Number(isHol ? rateHoliday : rateRegular) || 0;
      if (isHol) holiday += r;
      else base += r;
      extra += extraPets * extraPet;
      if (Number(durationMinutes) >= 60) duration += add60;
      unitCount += 1;
    }
  }

  const total = Math.round((base + holiday + extra + duration) * 100) / 100;
  return {
    base,
    holiday,
    extra_pet: extra,
    extra_pets: extraPets,
    duration,
    duration_minutes: durationMinutes || null,
    units: unitCount,
    pet_count: Number(petCount) || 0,
    total,
    sitter_keep: keep90(total),
  };
}
