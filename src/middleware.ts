import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Uses the Edge-safe config (no Prisma-backed provider) so this middleware
// can run in the Edge Runtime — see src/lib/auth.config.ts.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    if (!req.auth?.adminId) {
      const loginUrl = new URL("/admin/login", req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    return;
  }

  if (!req.auth?.clientId) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/reservation/:path*",
    "/api/reservations/:path*",
    "/api/availability",
    "/api/documents/:path*",
    "/api/contracts/:path*",
    "/api/deposits/:path*",
    "/api/files/:path*",
    "/dashboard/:path*",
  ],
};
