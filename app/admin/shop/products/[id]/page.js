import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ProductEditClient from "./ProductEditClient";

export const metadata = { title: "Edit product | Admin Shop" };

export default async function AdminProductEditPage({ params }) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=/admin/shop/products/${id}`);
  if (profile.role !== "admin") redirect("/account");

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("shop_products")
    .select("*, shop_product_media(*)")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const [{ data: brands }, { data: shops }, { data: categories }] = await Promise.all([
    supabase.from("shop_brands").select("id, name").order("name"),
    supabase.from("shop_shops").select("id, name, shop_type").order("name"),
    supabase.from("shop_categories").select("id, name").order("sort_order"),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop/products" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Products</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Edit product</h1>
      <ProductEditClient
        product={product}
        brands={brands || []}
        shops={shops || []}
        categories={categories || []}
        adminId={profile.id}
      />
    </div>
  );
}
