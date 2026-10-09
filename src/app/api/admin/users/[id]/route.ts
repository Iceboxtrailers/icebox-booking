import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";

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
