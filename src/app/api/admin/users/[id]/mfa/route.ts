import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";

// Owner-only: removes an employee's two-factor setup (lost phone). The employee can
// then sign in with their password and enrol again.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const { id } = await params;
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (user.role !== "employee") {
    return NextResponse.json({ error: "Seuls les comptes employés peuvent être réinitialisés ici" }, { status: 403 });
  }

  await prisma.adminUser.update({
    where: { id },
    data: {
      totpSecretEnc: null,
      totpPendingEnc: null,
      totpEnabledAt: null,
      totpLastUsedStep: null,
      recoveryCodeHashes: [],
      loginFailedAttempts: 0,
      loginLockedUntil: null,
    },
  });
  await logAudit({
    action: "employee_mfa_reset",
    actor: { type: "admin", id: guard.admin.id },
    details: { username: user.username },
  });

  return NextResponse.json({ ok: true });
}
