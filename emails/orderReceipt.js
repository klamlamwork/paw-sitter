import { buttonHtml, emailLayout, escapeHtml } from "./layout";

function money(cents, currency) {
  const n = Number(cents || 0) / 100;
  return `${(currency || "CAD").toUpperCase()} ${n.toFixed(2)}`;
}

export function renderOrderReceipt({ role, shopName, orderId, items, totalCents, currency, shipLabel, href }) {
  const forSeller = role === "seller";
  const title = forSeller ? "New shop order" : "Order confirmation";
  const rows = (items || [])
    .map((item) => `<tr><td style="padding:6px 0;border-bottom:1px solid #f3e0d0;">${escapeHtml(item.name)} × ${Number(item.qty || 0)}</td><td style="padding:6px 0;border-bottom:1px solid #f3e0d0;text-align:right;">${money((item.price_cents || 0) * (item.qty || 0), item.currency || currency)}</td></tr>`)
    .join("");
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${
      forSeller
        ? `A customer placed an order at <strong>${escapeHtml(shopName || "your shop")}</strong>.`
        : `Thanks for your order from <strong>${escapeHtml(shopName || "the shop")}</strong>.`
    }</p>
    <p style="margin:0 0 12px;font-size:13px;color:#7a5c4e;">Order ${escapeHtml(String(orderId || "").slice(0, 8))}</p>
    <table width="100%" cellpadding="0" cellspacing="0">${rows || "<tr><td>See your order page for items.</td></tr>"}</table>
    <p style="margin:12px 0 0;font-weight:700;">Total ${money(totalCents, currency)}</p>
    ${shipLabel ? `<p style="margin:12px 0 0;font-size:14px;color:#5c4033;">${escapeHtml(shipLabel)}</p>` : ""}
    ${buttonHtml(href, forSeller ? "Fulfill order" : "View order")}
  `;
  return {
    subject: forSeller ? `New order at ${shopName || "your shop"}` : `Order confirmation from ${shopName || "Joyful Paws"}`,
    html: emailLayout({ title, preview: title, bodyHtml }),
    text: `${title}. Total ${money(totalCents, currency)}. ${href}`,
  };
}
