import bcrypt from "bcryptjs";
import type { AdminUser } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { hashRecoveryCode, verifyTotp } from "@/lib/totp";

const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; admin: AdminUser }
  | { ok: false; reason: "invalid" | "locked" | "mfa_required" | "mfa_invalid" };

// Compared against when the username doesn't exist, so a missing account takes
// about as long to reject as a wrong password.
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  dummyHash ??= await bcrypt.hash("not-a-real-password", 12);
  return dummyHash;
}

async function registerFailure(admin: AdminUser) {
  const attempts = admin.loginFailedAttempts + 1;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { loginFailedAttempts: 0, loginLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) },
    });
  } else {
    await prisma.adminUser.update({ where: { id: admin.id }, data: { loginFailedAttempts: attempts } });
  }
}

async function clearFailures(admin: AdminUser) {
  if (admin.loginFailedAttempts > 0 || admin.loginLockedUntil) {
    await prisma.adminUser.update({ where: { id: admin.id }, data: { loginFailedAttempts: 0, loginLockedUntil: null } });
  }
}

// Single place that decides whether an admin may sign in. `code` is the 6-digit
// authenticator code or a one-time recovery code; without it, an account that
// has two-factor enabled gets "mfa_required" (no failure counted).
export async function verifyAdminLogin(input: { username: string; password: string; code?: string }): Promise<LoginResult> {
  const admin = await prisma.adminUser.findFirst({
    where: { username: { equals: input.username, mode: "insensitive" } },
  });
  if (!admin) {
    await bcrypt.compare(input.password, await getDummyHash());
    return { ok: false, reason: "invalid" };
  }
  if (admin.loginLockedUntil && admin.loginLockedUntil > new Date()) return { ok: false, reason: "locked" };

  if (!(await bcrypt.compare(input.password, admin.passwordHash))) {
    await registerFailure(admin);
    return { ok: false, reason: "invalid" };
  }

  if (!admin.totpEnabledAt || !admin.totpSecretEnc) {
    await clearFailures(admin);
    return { ok: true, admin };
  }

  const code = input.code?.trim();
  if (!code) return { ok: false, reason: "mfa_required" };

  const step = verifyTotp(decryptSecret(admin.totpSecretEnc), code, admin.totpLastUsedStep);
  if (step !== null) {
    // Compare-and-set so the same code can't be accepted twice, even concurrently.
    const { count } = await prisma.adminUser.updateMany({
      where: { id: admin.id, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: step } }] },
      data: { totpLastUsedStep: step, loginFailedAttempts: 0, loginLockedUntil: null },
    });
    if (count === 1) return { ok: true, admin };
  }

  const hash = hashRecoveryCode(code);
  if (admin.recoveryCodeHashes.includes(hash)) {
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        recoveryCodeHashes: admin.recoveryCodeHashes.filter((h) => h !== hash),
        loginFailedAttempts: 0,
        loginLockedUntil: null,
      },
    });
    return { ok: true, admin };
  }

  await registerFailure(admin);
  return { ok: false, reason: "mfa_invalid" };
}
