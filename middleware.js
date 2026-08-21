import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function setRefCookie(response, code) {
  response.cookies.set("paw_ref", String(code).trim().toUpperCase(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function middleware(request) {
  const url = request.nextUrl;
  const ref = url.searchParams.get("ref") || "";
  const hasCookie = !!request.cookies.get("paw_ref")?.value;

  if (url.pathname === "/signup") {
    const next = url.clone();
    next.pathname = "/login";
    const redirect = NextResponse.redirect(next);
    if (ref && !hasCookie) setRefCookie(redirect, ref);
    return redirect;
  }

  const response = await updateSession(request);
  if (ref && !hasCookie) setRefCookie(response, ref);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
