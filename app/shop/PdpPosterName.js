import Link from "next/link";
import { brandShopPath, shopPath } from "@/lib/shop";

export default function PdpPosterName({ shop }) {
  if (!shop?.name) return null;
  const href = shop.is_product_brand ? brandShopPath(shop) : shopPath(shop);
  return (
    <Link
      href={href || "/shop"}
      className="text-xs font-bold uppercase tracking-wide text-[#c45c26] hover:underline"
    >
      {shop.name}
    </Link>
  );
}
