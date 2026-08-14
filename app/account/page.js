import AccountLocationClient from "./AccountLocationClient";
import MyPawKidsClient from "./MyPawKidsClient";
import { auth } from "@/auth";

export default async function AccountPage() {
  const session = await auth();
  const customerId = session?.user?.id;

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
