import ProductReviewsMount from "./ProductReviewsMount";

export default function ShopLayout({ children }) {
  return (
    <div data-page="shop">
      {children}
      <ProductReviewsMount />
    </div>
  );
}
