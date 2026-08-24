export function missingApplicationFields(sitter) {
  const missing = [];
  if (!String(sitter?.display_name || "").trim()) missing.push("Display name");
  if (!String(sitter?.bio || "").trim()) missing.push("Bio");
  if (!sitter?.location_id && !String(sitter?.service_city || "").trim()) missing.push("City and country");
  if (!String(sitter?.address_line1 || "").trim()) missing.push("Street address");
  if (!sitter?.phone_verified_at || !sitter?.phone_e164) missing.push("Verified phone");

  const services = (sitter?.sitter_services || []).filter((s) => s && s.enabled);
  if (!services.length) missing.push("At least one enabled service");
  else if (services.some((s) => !(Number(s.rate_regular) > 0))) missing.push("Base rate for each enabled service");

  const week = sitter?.sitter_weekly_availability || [];
  if (!week.some((w) => w.is_available)) missing.push("Weekly hours (at least one available day)");

  return missing;
}
