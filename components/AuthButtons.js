import { getProfile } from "@/lib/auth";
import AuthNav from "@/components/AuthNav";

export default async function AuthButtons() {
  const profile = await getProfile();
  return (
    <AuthNav
      profile={
        profile
          ? {
              role: profile.role,
              full_name: profile.full_name,
              email: profile.email,
            }
          : null
      }
    />
  );
}
