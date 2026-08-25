import StripeReturnHandler from "../checkout/StripeReturnHandler";

export default function ShopCartLayout({ children }) {
  return (
    <>
      <StripeReturnHandler />
      {children}
    </>
  );
}
