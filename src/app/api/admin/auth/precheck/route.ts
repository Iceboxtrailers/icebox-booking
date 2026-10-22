import { NextResponse } from "next/server";
import { adminLoginSchema } from "@/lib/validation";
import { verifyAdminLogin } from "@/lib/admin-login";
import { RATE_RULES, clientIp, rejectIfOverLimit } from "@/lib/rate-limit";

// Step one of the admin sign-in: checks the password and tells the page whether to
// ask for an authenticator code. It reveals nothing unless the password is right,
// and shares the failed-attempt lockout and the per-address limit with the real sign-in
// (/api/admin/auth/login).
export async function POST(request: Request) {
  const limited = await rejectIfOverLimit(RATE_RULES.adminLoginIp, clientIp(request));
  if (limited) return limited;

  const parsed = adminLoginSchema.pick({ username: true, password: true }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Identifiants invalides" }, { status: 400 });

  const result = await verifyAdminLogin(parsed.data);
  if (result.ok) return NextResponse.json({ mfaRequired: false });
  if (result.reason === "mfa_required") return NextResponse.json({ mfaRequired: true });
  if (result.reason === "locked") {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, { status: 429 });
  }
  return NextResponse.json({ error: "Nom d'utilisateur ou mot de passe invalide" }, { status: 401 });
}
