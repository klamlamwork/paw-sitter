import ProductReviewsMount from "./ProductReviewsMount";
import KolProductFeed from "./KolProductFeed";

export default function ShopLayout({ children }) {
  return (
    <div data-page="shop">
      {children}
      <ProductReviewsMount />
      <KolProductFeed />
    </div>
  );
}
