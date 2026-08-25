import { buttonHtml, emailLayout, escapeHtml } from "./layout";

const TITLES = {
  accepted: "Your order was accepted",
  shipped: "Your order has shipped",
  ready: "Your order is ready for pickup",
  ready_for_pickup: "Your order is ready for pickup",
  delivered: "Your order was delivered",
  declined: "Your order was declined",
  canceled: "Your order was canceled",
  cancelled: "Your order was canceled",
};

export function renderOrderStatus({ role, status, shopName, orderId, href }) {
  const key = status || "accepted";
  const title = role === "seller"
    ? (key === "canceled" || key === "cancelled" ? "An order was canceled" : `Order ${key}`)
    : (TITLES[key] || `Order update: ${key}`);
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">
      Order <strong>${escapeHtml(String(orderId || "").slice(0, 8))}</strong> from <strong>${escapeHtml(shopName || "the shop")}</strong> is now <strong>${escapeHtml(key.replace(/_/g, " "))}</strong>.
    </p>
    ${buttonHtml(href, role === "seller" ? "Open seller orders" : "View order")}
  `;
  return {
    subject: title,
    html: emailLayout({ title, preview: title, bodyHtml }),
    text: `${title}. ${href}`,
  };
}
