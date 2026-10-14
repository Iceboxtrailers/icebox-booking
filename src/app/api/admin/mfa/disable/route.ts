import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { hashRecoveryCode, verifyTotp } from "@/lib/totp";
import { mfaCodeSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

// Turning two-factor off needs a valid current code (or recovery code), so a stolen
// session alone can't remove it.
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const { admin } = guard;

  const parsed = mfaCodeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Entrez un code" }, { status: 400 });

  const current = await prisma.adminUser.findUnique({ where: { id: admin.id } });
  if (!current?.totpEnabledAt || !current.totpSecretEnc) {
    return NextResponse.json({ error: "La double authentification n'est pas activée" }, { status: 409 });
  }

  const validTotp = verifyTotp(decryptSecret(current.totpSecretEnc), parsed.data.code, current.totpLastUsedStep) !== null;
  const validRecovery = current.recoveryCodeHashes.includes(hashRecoveryCode(parsed.data.code));
  if (!validTotp && !validRecovery) return NextResponse.json({ error: "Code invalide" }, { status: 400 });

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      totpSecretEnc: null,
      totpPendingEnc: null,
      totpEnabledAt: null,
      totpLastUsedStep: null,
      recoveryCodeHashes: [],
    },
  });
  await logAudit({ action: "mfa_disabled", actor: { type: "admin", id: admin.id }, details: { username: admin.username } });

  return NextResponse.json({ ok: true });
}
