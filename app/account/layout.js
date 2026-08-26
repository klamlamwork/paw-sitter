import { getProfile } from "@/lib/auth";
import AccountAvatarUpload from "@/components/media/AccountAvatarUpload";

export default async function AccountLayout({ children }) {
  const profile = await getProfile();
  return (
    <>
      {profile ? <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6"><AccountAvatarUpload initialPublicId={profile.avatar_public_id} initialVersion={profile.avatar_version} /></div> : null}
      {children}
    </>
  );
}
