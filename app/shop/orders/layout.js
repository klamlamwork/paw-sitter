import StripeReturnHandler from "../checkout/StripeReturnHandler";

export default function ShopOrdersLayout({ children }) {
  return (
    <>
      <StripeReturnHandler />
      {children}
    </>
  );
}
