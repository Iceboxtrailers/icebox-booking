import { NextResponse } from "next/server";
import { adminLoginSchema } from "@/lib/validation";
import { verifyAdminLogin } from "@/lib/admin-login";
import { adminSessionCookie, createAdminSessionToken } from "@/lib/admin-session";
import { RATE_RULES, clientIp, rejectIfOverLimit } from "@/lib/rate-limit";

// Signs a staff member in to the console: password, lockout and two-factor checks (all in verifyAdminLogin),
// then the console's own session cookie. This session is separate from the clients' and guests', so signing
// in here does not end a booking session open in the same browser, and the other way round.
export async function POST(request: Request) {
  const limited = await rejectIfOverLimit(RATE_RULES.adminLoginIp, clientIp(request));
  if (limited) return limited;

  const parsed = adminLoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Identifiants invalides" }, { status: 400 });

  const result = await verifyAdminLogin(parsed.data);
  if (!result.ok) {
    if (result.reason === "locked") {
      return NextResponse.json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, { status: 429 });
    }
    if (result.reason === "mfa_required") {
      return NextResponse.json({ error: "Code de vérification requis", mfaRequired: true }, { status: 401 });
    }
    // Wrong password, unknown account, wrong or reused code: the same answer for all.
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  const token = await createAdminSessionToken(result.admin.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminSessionCookie(token, new URL(request.url).protocol === "https:"));
  return response;
}
