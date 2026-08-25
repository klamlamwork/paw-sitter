import StripeReturnHandler from "./StripeReturnHandler";

export default function ShopCheckoutLayout({ children }) {
  return (
    <>
      <StripeReturnHandler />
      {children}
    </>
  );
}
