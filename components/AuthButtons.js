import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AuthNav from "@/components/AuthNav";

export default async function AuthButtons() {
  const profile = await getProfile();
  let hasShop = false;
  if (profile?.id) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("shop_shops").select("id").eq("owner_profile_id", profile.id).limit(1);
      hasShop = !!(data && data.length);
    } catch {
      hasShop = false;
    }
  }
  return (
    <AuthNav
      profile={
        profile
          ? {
              role: profile.role,
              full_name: profile.full_name,
              email: profile.email,
              hasShop,
              avatar_url: profile.avatar_url || profile.photo_url || profile.profile_pic_url || "",
            }
          : null
      }
    />
  );
}
