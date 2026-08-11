import { createClient } from "@/lib/supabase/server";
export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return profile ? { ...profile, authUser: user } : null;
}
export async function requireRole(roles) {
  const profile = await getProfile();
  const list = Array.isArray(roles) ? roles : [roles];
  if (!profile || !list.includes(profile.role)) return null;
  return profile;
}
