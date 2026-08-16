export async function sendEmail({ to, subject, html, text }) {
  if (!to) return { skipped: true, reason: "no recipient" };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: true, reason: "RESEND_API_KEY not set" };
  const from = process.env.EMAIL_FROM || "Paw Sitter <beth.t@example.com>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text: text || undefined }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Email send failed");
  }
  return { ok: true };
}
