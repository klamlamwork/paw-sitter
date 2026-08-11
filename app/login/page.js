import { Suspense } from "react";
import LoginClient from "./LoginClient";
export const metadata = { title: "Login | Paw Sitter" };
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}
