import { getProfile } from "@/lib/auth";
import AccountAvatarGate from "@/components/media/AccountAvatarGate";
import AccountReviewMount from "./AccountReviewMount";

export default async function AccountLayout({ children }) {
  const profile = await getProfile();
  return (
    <>
      {profile ? (
        <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
          <AccountAvatarGate initialPublicId={profile.avatar_public_id} initialVersion={profile.avatar_version} />
        </div>
      ) : null}
      {children}
      {profile ? <AccountReviewMount /> : null}
    </>
  );
}
