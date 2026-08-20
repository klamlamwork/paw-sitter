import { Suspense } from "react";
import UpdatePasswordClient from "./UpdatePasswordClient";

export const metadata = { title: "Set password | Paw Sitter" };

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <UpdatePasswordClient />
    </Suspense>
  );
}
