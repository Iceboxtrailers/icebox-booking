import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminId } from "@/lib/session";
import type { AdminRole } from "@/lib/constants";

export type CurrentAdmin = { id: string; username: string; role: AdminRole };

// Role is read from the database on every call (not from the JWT) so demoting
// or removing a staff account takes effect immediately.
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const adminId = await getCurrentAdminId();
  if (!adminId) return null;
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) return null;
  return { id: admin.id, username: admin.username, role: admin.role === "employee" ? "employee" : "owner" };
}

// For server-rendered dashboard pages: staff accounts are sent back to the board.
export async function requireOwnerPage(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.role !== "owner") redirect("/dashboard");
  return admin;
}

type Guard = { admin: CurrentAdmin; error?: undefined } | { admin?: undefined; error: NextResponse };

export async function requireAdmin(): Promise<Guard> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  return { admin };
}

export async function requireOwner(): Promise<Guard> {
  const guard = await requireAdmin();
  if (guard.error) return guard;
  if (guard.admin.role !== "owner") {
    return { error: NextResponse.json({ error: "Réservé au propriétaire" }, { status: 403 }) };
  }
  return guard;
}
