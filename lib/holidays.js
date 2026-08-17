export function toHolidayKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const x = new Date(value);
  if (Number.isNaN(x.getTime())) return "";
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function holidaySetFromRows(rows) {
  return new Set((rows || []).map((row) => toHolidayKey(row.holiday_date || row.date || row)).filter(Boolean));
}
