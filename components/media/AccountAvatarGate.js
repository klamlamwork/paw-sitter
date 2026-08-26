"use client";

import { usePathname } from "next/navigation";
import AccountAvatarUpload from "./AccountAvatarUpload";

export default function AccountAvatarGate({ initialPublicId, initialVersion }) {
  const pathname = usePathname();
  // Do not show the profile editor on shop, shop orders, Paw Points, or other
  // nested account routes. Those pages inherit the /account layout.
  if (pathname !== "/account") return null;
  return <AccountAvatarUpload initialPublicId={initialPublicId} initialVersion={initialVersion} />;
}
