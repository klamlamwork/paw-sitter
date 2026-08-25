import { buttonHtml, emailLayout, escapeHtml } from "./layout";

export function renderSitterDaily({ sitterName, lines, href }) {
  const title = "Today's sittings";
  const list = (lines || []).map((line) => `<li style="margin:0 0 8px;">${escapeHtml(line)}</li>`).join("");
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hi ${escapeHtml(sitterName || "there")}, here is your upcoming sitting list.</p>
    <ul style="margin:0;padding-left:18px;">${list || "<li>No upcoming sittings in the next 48 hours.</li>"}</ul>
    ${buttonHtml(href, "Open bookings")}
  `;
  return {
    subject: "Your upcoming Joyful Paws sittings",
    html: emailLayout({ title, preview: title, bodyHtml }),
    text: `${title}\n${(lines || []).join("\n")}\n${href}`,
  };
}
