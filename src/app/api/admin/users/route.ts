import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { adminUserCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

// Owner-only: creates a staff (employee) login. The owner types the password in
// the form — it never passes through chat or the repo.
export async function POST(request: Request) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => null);
  const parsed = adminUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const existing = await prisma.adminUser.findUnique({ where: { username: parsed.data.username } });
  if (existing) return NextResponse.json({ error: "Ce nom d'utilisateur existe déjà" }, { status: 409 });

  const user = await prisma.adminUser.create({
    data: {
      username: parsed.data.username,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      role: "employee",
    },
  });
  await logAudit({
    action: "employee_created",
    actor: { type: "admin", id: guard.admin.id },
    details: { username: user.username },
  });

  return NextResponse.json({ id: user.id, username: user.username, role: user.role });
}
