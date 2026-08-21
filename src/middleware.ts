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

  // Fleet photos are admin-managed assets, not client-owned documents — the
  // client-session gate below would otherwise bounce admin requests to
  // /login before the route handler's own admin check ever runs.
  if (req.nextUrl.pathname.startsWith("/api/files/trailers")) {
    if (!req.auth?.adminId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return;
  }

  // Staff are a party to every contract, so an admin session alone should
  // reach these — same reasoning as /api/files/trailers above. The route
  // handler still checks ownership for the client-session fallback path.
  if (req.nextUrl.pathname.startsWith("/api/files/contracts") || req.nextUrl.pathname.startsWith("/api/files/signatures")) {
    if (!req.auth?.adminId && !req.auth?.clientId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
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
