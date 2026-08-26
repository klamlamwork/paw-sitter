import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import SitterPhotoUpload from "@/components/media/SitterPhotoUpload";

export default async function SitterDashboardLayout({ children }) {
  const profile = await getProfile();
  let sitter = null;
  if (profile?.id) {
    const admin = createAdminClient();
    const { data } = await admin.from("sitters").select("id, profile_pic_public_id, profile_pic_version").eq("profile_id", profile.id).maybeSingle();
    sitter = data;
  }
  return (
    <>
      {sitter ? <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6"><SitterPhotoUpload sitter={sitter} /></div> : null}
      {children}
    </>
  );
}
