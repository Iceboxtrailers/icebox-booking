import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";

const passwordResetSchema = z.object({
  password: z.string().min(10, "Mot de passe : 10 caractères minimum"),
});

// Owner-only: sets a new password for a staff login.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const { id } = await params;
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (user.role !== "employee") {
    return NextResponse.json({ error: "Seuls les comptes employés sont modifiables ici" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = passwordResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  await prisma.adminUser.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) },
  });
  await logAudit({
    action: "employee_password_reset",
    actor: { type: "admin", id: guard.admin.id },
    details: { username: user.username },
  });

  return NextResponse.json({ ok: true });
}

// Owner-only: removes a staff login. Owner accounts can't be deleted here.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const { id } = await params;
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (user.role !== "employee") {
    return NextResponse.json({ error: "Seuls les comptes employés peuvent être supprimés" }, { status: 403 });
  }

  await prisma.adminUser.delete({ where: { id } });
  await logAudit({
    action: "employee_deleted",
    actor: { type: "admin", id: guard.admin.id },
    details: { username: user.username },
  });

  return NextResponse.json({ ok: true });
}
