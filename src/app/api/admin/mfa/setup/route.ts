import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { encryptSecret } from "@/lib/crypto/secret-box";
import { generateTotpSecret, otpauthUrl } from "@/lib/totp";

// Starts enrolment: creates a fresh secret and shows it as a QR code. It only
// becomes active once the user proves their app works by entering a code.
export async function POST() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const { admin } = guard;

  const current = await prisma.adminUser.findUnique({ where: { id: admin.id } });
  if (current?.totpEnabledAt) {
    return NextResponse.json({ error: "La double authentification est déjà activée" }, { status: 409 });
  }

  const secret = generateTotpSecret();
  await prisma.adminUser.update({ where: { id: admin.id }, data: { totpPendingEnc: encryptSecret(secret) } });

  const qr = await QRCode.toDataURL(otpauthUrl(admin.username, secret, "IceBox"), { margin: 1, width: 220 });
  return NextResponse.json({ secret, qr });
}
