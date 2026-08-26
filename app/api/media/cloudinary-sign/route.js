import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sign(params, secret) {
  const base = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("sha1").update(base + secret).digest("hex");
}

async function ownsAnyShop(admin, userId) {
  const { data } = await admin.from("shop_shops").select("id").eq("owner_profile_id", userId).limit(1).maybeSingle();
  return !!data?.id;
}

export async function POST(request) {
  try {
    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
    const apiKey = (process.env.CLOUDINARY_API_KEY || "").trim();
    const apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Vercel." }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const { kind, product_id } = await request.json();
    const admin = createAdminClient();
    let folder = "";
    let publicId = "";
    let overwrite = false;

    if (kind === "profile") {
      folder = `joyful-paws/profiles/${user.id}`;
      publicId = "avatar";
      overwrite = true;
    } else if (kind === "sitter") {
      const { data: sitter } = await admin.from("sitters").select("id").eq("profile_id", user.id).maybeSingle();
      if (!sitter) return NextResponse.json({ error: "No sitter profile is linked to this account." }, { status: 403 });
      folder = `joyful-paws/sitters/${sitter.id}`;
      publicId = "profile";
      overwrite = true;
    } else if (kind === "product") {
      if (product_id) {
        const { data: product } = await admin
          .from("shop_products")
          .select("id, primary_shop_id, brand_shop_id")
          .eq("id", product_id)
          .maybeSingle();
        if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
        const shopIds = [product.primary_shop_id, product.brand_shop_id].filter(Boolean);
        const { data: owned } = shopIds.length
          ? await admin.from("shop_shops").select("id").in("id", shopIds).eq("owner_profile_id", user.id).limit(1).maybeSingle()
          : { data: null };
        if (!owned?.id) return NextResponse.json({ error: "You can upload only for products in your own shop." }, { status: 403 });
        folder = `joyful-paws/products/${product.id}/gallery`;
      } else {
        // New products have no ID yet. Permit a draft gallery only for users
        // who own a shop; the DB trigger stores identifiers, never URLs.
        if (!(await ownsAnyShop(admin, user.id))) {
          return NextResponse.json({ error: "Create or join a shop before uploading product images." }, { status: 403 });
        }
        folder = `joyful-paws/products/drafts/${user.id}/gallery`;
      }
      publicId = crypto.randomUUID();
    } else {
      return NextResponse.json({ error: "Invalid media kind." }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const params = { folder, public_id: publicId, timestamp, overwrite: overwrite ? "true" : undefined };
    return NextResponse.json({
      cloud_name: cloudName,
      api_key: apiKey,
      timestamp,
      folder,
      public_id: publicId,
      overwrite,
      signature: sign(params, apiSecret),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not sign Cloudinary upload." }, { status: 500 });
  }
}
