import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import AccountLocationClient from "./AccountLocationClient";
import MyPawKidsClient from "./MyPawKidsClient";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const supabase = createAdminClient(cookieStore.get("sb-access-token")?.value);
  const { data: { user } } = await supabase.auth.getUser();
  const customerId = user?.id;

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-bold">Account</h1>
      {!customerId ? (
        <p className="mt-2 text-sm text-[#7a5c4e]">Please log in to view your account.</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <AccountLocationClient customerId={customerId} />
          <MyPawKidsClient customerId={customerId} />
        </div>
      )}
    </div>
  );
}
