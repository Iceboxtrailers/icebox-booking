import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { generateRecoveryCodes, hashRecoveryCode, verifyTotp } from "@/lib/totp";
import { mfaCodeSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const { admin } = guard;

  const parsed = mfaCodeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Entrez le code à 6 chiffres" }, { status: 400 });

  const current = await prisma.adminUser.findUnique({ where: { id: admin.id } });
  if (!current?.totpPendingEnc || current.totpEnabledAt) {
    return NextResponse.json({ error: "Aucune activation en cours — recommencez" }, { status: 409 });
  }

  const pendingSecret = decryptSecret(current.totpPendingEnc);
  const step = verifyTotp(pendingSecret, parsed.data.code, null);
  if (step === null) return NextResponse.json({ error: "Code invalide — vérifiez l'heure de votre téléphone" }, { status: 400 });

  const recoveryCodes = generateRecoveryCodes();
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      totpSecretEnc: current.totpPendingEnc,
      totpPendingEnc: null,
      totpEnabledAt: new Date(),
      totpLastUsedStep: step,
      recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
    },
  });
  await logAudit({ action: "mfa_enabled", actor: { type: "admin", id: admin.id }, details: { username: admin.username } });

  // Shown once: only their hashes are stored.
  return NextResponse.json({ recoveryCodes });
}
