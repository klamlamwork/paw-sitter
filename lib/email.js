function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function isEmailSandbox() {
  return !!(process.env.EMAIL_SANDBOX_TO || "").trim();
}

export function resolveEmailRecipient(intended) {
  const sandbox = (process.env.EMAIL_SANDBOX_TO || "").trim();
  if (sandbox) return { to: sandbox, intended: intended || sandbox, sandbox: true };
  return { to: intended, intended, sandbox: false };
}

export async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!to) return { skipped: true, reason: "no recipient" };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: true, reason: "RESEND_API_KEY not set" };

  const routed = resolveEmailRecipient(to);
  if (!routed.to) return { skipped: true, reason: "no recipient" };

  const from = process.env.EMAIL_FROM || "Joyful Paws <beth.t@example.com>";
  const finalSubject = routed.sandbox && routed.intended && routed.intended !== routed.to
    ? `[to: ${routed.intended}] ${subject}`
    : subject;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: routed.to,
      subject: finalSubject,
      html,
      text: text || undefined,
      reply_to: replyTo || undefined,
      headers: routed.intended ? { "X-Intended-Recipient": routed.intended } : undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Email send failed");
  }
  return { ok: true, to: routed.to, intended: routed.intended, sandbox: routed.sandbox };
}

export { siteUrl };
