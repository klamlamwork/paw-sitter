export function emailLayout({ title, preview, bodyHtml }) {
  const safeTitle = title || "Joyful Paws";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(safeTitle)}</title>
</head>
<body style="margin:0;background:#fff8f0;font-family:Georgia,serif;color:#3b2a22;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preview || "")}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e8d5c4;border-radius:24px;padding:28px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#c45c26;">Joyful Paws</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">${escapeHtml(safeTitle)}</h1>
          ${bodyHtml}
          <p style="margin:28px 0 0;font-size:12px;color:#7a5c4e;">You received this because you have an account on Joyful Paws / Paw Sitter.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buttonHtml(href, label) {
  return `<p style="margin:24px 0 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#c45c26;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:14px;font-weight:700;">${escapeHtml(label)}</a></p>`;
}
