import { redirect } from "next/navigation";

/** Brands are shops with is_product_brand — no separate entity. */
export default function AdminShopBrandsRedirect() {
  redirect("/admin/shop/shops?filter=product_brand");
}
