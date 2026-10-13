import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin-auth";
import { buildAuthorizeUrl, quickBooksConfigured } from "@/lib/accounting/quickbooks";

// Starts the Intuit OAuth flow. The owner signs in to Intuit themselves; we only
// ever receive the resulting authorization code.
export async function GET(request: Request) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;
  if (!quickBooksConfigured()) {
    return NextResponse.json({ error: "QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET manquants dans Vercel" }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(buildAuthorizeUrl(`${origin}/api/admin/quickbooks/callback`, state));
  response.cookies.set("qb_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/admin/quickbooks",
  });
  return response;
}
