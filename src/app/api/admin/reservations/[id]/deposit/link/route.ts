import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";

const LINK_VALID_DAYS = 7;

// Creates a secure link the client opens on their own phone to confirm the
// hold themselves (3-D Secure, replaced card, or no card saved yet).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const { admin } = guard;

  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (reservation.status !== "confirmed" && reservation.status !== "in_progress") {
    return NextResponse.json({ error: "La réservation doit être confirmée" }, { status: 409 });
  }
  if (!["none", "card_on_file", "expired", "authorized"].includes(reservation.depositStatus)) {
    return NextResponse.json({ error: "Aucune retenue à placer pour le moment" }, { status: 409 });
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_VALID_DAYS * 24 * 60 * 60 * 1000);
  await prisma.reservation.update({
    where: { id },
    data: { depositToken: token, depositTokenExpiresAt: expiresAt },
  });
  await logAudit({
    action: "deposit_link_created",
    reservationId: id,
    actor: { type: "admin", id: admin.id },
    details: { expiresAt: expiresAt.toISOString() },
  });

  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/depot/${token}`, expiresAt: expiresAt.toISOString() });
}
