export function keep90(amount) {
  return Math.round((Number(amount) || 0) * 90) / 100;
}

export function extraPetsFromCount(petCount) {
  return Math.max(0, (Number(petCount) || 0) - 1);
}

export function dateKey(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
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

function collectVisits(dates) {
  const visits = [];
  for (const d of dates || []) {
    const day = d?.date || d;
    const times = Array.isArray(d?.times) ? d.times : [];
    if (times.length) {
      for (const time of times) visits.push({ date: day, time });
    }
  }
  return visits;
}

export function estimateBookingPrice({
  serviceType,
  dates = [],
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
  const units = (dates || []).map((d) => new Date(d.date || d)).filter((d) => !Number.isNaN(d.getTime()));
  const holidayKeys = holidaySet instanceof Set ? holidaySet : new Set(holidaySet || []);

  let base = 0;
  let holiday = 0;
  let extra = 0;
  let duration = 0;
  let unitCount = 0;
  let holidayUnits = 0;

  if (overnight) {
    const nights = units.length >= 2 ? units.length - 1 : 0;
    const nightDates = units.slice(0, nights);
    for (const d of nightDates) {
      const isHol = holidayKeys.has(dateKey(d));
      const r = Number(isHol ? rateHoliday : rateRegular) || 0;
      if (isHol) { holiday += r; holidayUnits += 1; }
      else base += r;
      extra += extraPets * extraPet;
      unitCount += 1;
    }
  } else {
    const visits = collectVisits(dates);
    const use60 = Number(durationMinutes) >= 60;
    for (const visit of visits) {
      const isHol = holidayKeys.has(dateKey(visit.date));
      const r = Number(isHol ? rateHoliday : rateRegular) || 0;
      if (isHol) { holiday += r; holidayUnits += 1; }
      else base += r;
      extra += extraPets * extraPet;
      if (use60) duration += add60;
      unitCount += 1;
    }
  }

  const total = Math.round((base + holiday + extra + duration) * 100) / 100;
  return {
    base,
    holiday,
    extra_pet: extra,
    extra_pets: extraPets,
    pet_count: Number(petCount) || 0,
    duration,
    duration_minutes: overnight ? null : Number(durationMinutes) || 30,
    units: unitCount,
    holiday_units: holidayUnits,
    unit_label: overnight ? "night" : "visit",
    base_rate: Number(rateRegular) || 0,
    extra_pet_rate: extraPet,
    rate_60: add60,
    total,
    sitter_keep: keep90(total),
  };
}
