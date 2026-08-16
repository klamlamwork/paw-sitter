import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canRateItem } from "@/lib/shopRatings";
import RateProductForm from "./RateProductForm";

export const metadata = { title: "Rate product | Paw Sitter" };

export default async function RateProductPage({ params }) {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/shop/orders");
  const { itemId } = await params;
  const access = await canRateItem(itemId, profile);
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link href="/shop/orders" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Your orders</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Rate {access.item?.product?.name || "this product"}</h1>
      {!access.ok ? <p className="mt-4 text-sm text-red-600">{access.reason}</p> : <RateProductForm itemId={itemId} options={access.options} />}
    </div>
  );
}
