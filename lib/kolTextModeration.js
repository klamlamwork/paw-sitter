const URL_RE = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|ca|org|net|io|co|shop|store|app)\b)/i;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const CONTACT_RE = /\b(?:dm\s+me|message\s+me|contact\s+me|text\s+me|whatsapp|telegram|wechat|call\s+me)\b/i;
const ORDER_SERVICE_RE = /\b(?:courier|delivery(?:\s+driver)?|shipping|parcel|package|late\s+delivery|lost\s+package|customer\s+service|seller\s+service|refund|chargeback|payment)\b/i;
const ABUSE_RE = /\b(?:kill\s+yourself|kys|hate\s+you|nigg(?:er|a)|fagg(?:ot)?|cunt|rape)\b/i;
const SPAM_RE = /\b(?:free\s+money|crypto\s+giveaway|click\s+here|buy\s+followers|work\s+from\s+home)\b/i;

export function normalizeModerationText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/([a-z])\1{3,}/g, "$1$1")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\s+/g, " ")
    .trim();
}

export function screenKolText({ title = "", body = "" } = {}) {
  const raw = `${title}\n${body}`.trim();
  const text = normalizeModerationText(raw);
  const reasons = [];
  if (EMAIL_RE.test(raw)) reasons.push("email_address");
  if (PHONE_RE.test(raw)) reasons.push("phone_number");
  if (URL_RE.test(raw)) reasons.push("external_link");
  if (CONTACT_RE.test(text)) reasons.push("off_platform_contact");
  if (ABUSE_RE.test(text)) reasons.push("abusive_content");
  if (SPAM_RE.test(text)) reasons.push("spam_pattern");
  if (raw.length > 5000) reasons.push("too_long");
  if (/(.)\1{11,}/.test(raw)) reasons.push("repeated_characters");
  if (ORDER_SERVICE_RE.test(text) && raw.length < 500) reasons.push("order_service_complaint");
  return {
    ok: reasons.length === 0,
    reasons,
    message: reasons.length
      ? "Please remove personal contact details, external links, spam, abusive language, or order-service issues. Product reviews should focus on the product itself."
      : "",
  };
}
