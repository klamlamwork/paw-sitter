"use client";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function BuyButtonsFields({ value, onChange }) {
  const v = {
    show_affiliate: false,
    show_add_to_cart: false,
    affiliate_url: "",
    ...value,
  };

  function set(patch) {
    onChange({ ...v, ...patch });
  }

  return (
    <div className="space-y-2 rounded-xl border border-[#e8d5c4] bg-white p-3">
      <p className="text-sm font-semibold text-[#3b2a22]">How customers buy</p>
      <p className="text-xs text-[#7a5c4e]">
        Choose affiliate / external, add to cart on Paw Sitter, both, or neither (catalog only).
        These apply to <strong>your shop&apos;s listing</strong> and update without admin approval.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={!!v.show_affiliate}
          onChange={(e) => set({ show_affiliate: e.target.checked })}
        />
        <span>
          <span className="font-medium">Affiliate / external button</span>
          <span className="block text-xs text-[#7a5c4e]">Sends the shopper to your URL</span>
        </span>
      </label>
      {v.show_affiliate ? (
        <label className="block text-sm font-medium">
          Affiliate / product URL
          <input
            className={inp}
            type="url"
            placeholder="https://…"
            value={v.affiliate_url || ""}
            onChange={(e) => set({ affiliate_url: e.target.value })}
            required={!!v.show_affiliate}
          />
        </label>
      ) : null}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={!!v.show_add_to_cart}
          onChange={(e) => set({ show_add_to_cart: e.target.checked })}
        />
        <span>
          <span className="font-medium">Add to cart (Paw Sitter checkout)</span>
          <span className="block text-xs text-[#7a5c4e]">
            Cart/pay ships next. Needs an active, in-stock variety when checkout goes live.
          </span>
        </span>
      </label>
    </div>
  );
}
