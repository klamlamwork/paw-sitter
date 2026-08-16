import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { startConnectOnboarding } from "@/lib/stripeConnect";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in." }, { status: 401 });
    const { kind } = await request.json();
    const supabase = await createClient();
    if (kind === "sitter") {
      const { data: sitter } = await supabase.from("sitters").select("id").eq("profile_id", profile.id).maybeSingle();
      if (!sitter) return NextResponse.json({ error: "Sitter profile not found." }, { status: 400 });
      const result = await startConnectOnboarding({ profile, kind: "sitter", sitterId: sitter.id });
      return NextResponse.json(result);
    }
    if (kind === "shop") {
      const { data: shop } = await supabase.from("shop_shops").select("id").eq("owner_profile_id", profile.id).order("created_at").limit(1).maybeSingle();
      if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 400 });
      const result = await startConnectOnboarding({ profile, kind: "shop", shopId: shop.id });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "kind must be sitter or shop." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start onboarding" }, { status: 500 });
  }
}
