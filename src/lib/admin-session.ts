import { decode, encode } from "next-auth/jwt";

// The console's own session, kept apart from the clients' and guests' (Auth.js, src/lib/auth.ts): different
// cookie, so signing in to one never ends the other in the same browser.
//
// The cookie holds an Auth.js encrypted token (the same vetted JWE the client session uses), made with the
// cookie name as its salt: a token issued for the clients' cookie cannot be opened as an admin one, nor the
// other way round, even though the secret is the same. This module does not touch the database or
// `next/headers`, so the middleware (Edge) and the server code can both use it.

// No "__Secure-" prefix on purpose: its name has to be the same over http (local runs) and https.
export const ADMIN_SESSION_COOKIE = "icebox-admin.session-token";

// After this long the admin signs in again (the staff account itself is still checked in the database on
// every request, see getCurrentAdmin).
export const ADMIN_SESSION_SECONDS = 30 * 24 * 60 * 60;

type AdminClaims = { kind: "admin"; adminId: string };

function secret(): string | null {
  return process.env.AUTH_SECRET?.trim() || null;
}

export async function createAdminSessionToken(adminId: string): Promise<string> {
  const key = secret();
  if (!key) throw new Error("AUTH_SECRET n'est pas configuré");
  const claims: AdminClaims = { kind: "admin", adminId };
  return encode({ token: claims, secret: key, salt: ADMIN_SESSION_COOKIE, maxAge: ADMIN_SESSION_SECONDS });
}

// The admin a cookie value stands for, or null for anything that is not a valid, unexpired admin token.
export async function readAdminSessionToken(token: string | null | undefined): Promise<{ adminId: string } | null> {
  const key = secret();
  if (!token || !key) return null;
  try {
    const payload = await decode({ token, secret: key, salt: ADMIN_SESSION_COOKIE });
    if (payload?.kind !== "admin" || typeof payload.adminId !== "string" || !payload.adminId) return null;
    return { adminId: payload.adminId };
  } catch {
    return null;
  }
}

// Attributes of the cookie: not readable by scripts, sent on the site's own navigations and on links
// followed from an email, and only over https when the site is served over https.
export function adminSessionCookie(token: string, secure: boolean) {
  return {
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge: ADMIN_SESSION_SECONDS,
  };
}

export function clearedAdminSessionCookie(secure: boolean) {
  return { ...adminSessionCookie("", secure), maxAge: 0 };
}
