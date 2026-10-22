import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { ADMIN_SESSION_COOKIE, readAdminSessionToken } from "@/lib/admin-session";
import { decideAccess } from "@/lib/access";

// Uses the Edge-safe config (no Prisma-backed provider) so this middleware
// can run in the Edge Runtime — see src/lib/auth.config.ts. `req.auth` is the booking pages' session
// (client or guest); the console's session is its own cookie, read below. Which of the two a page needs
// is decided in src/lib/access.ts.
const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  const admin = await readAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  const decision = decideAccess({
    pathname: req.nextUrl.pathname,
    adminId: admin?.adminId ?? null,
    clientId: req.auth?.clientId ?? null,
  });

  if (decision.kind === "redirect") {
    const loginUrl = new URL(decision.to, req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", decision.callbackUrl);
    return NextResponse.redirect(loginUrl);
  }
  if (decision.kind === "unauthorized") {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
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
