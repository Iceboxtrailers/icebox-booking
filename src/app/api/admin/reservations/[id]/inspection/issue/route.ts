import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { adminInspectionSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

// Flags a problem found at return. The deposit stays held; only the owner can
// then charge part of it or accept the return.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const { admin } = guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminInspectionSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const notes = parsed.data.notes;
  if (!notes || notes.length < 3) {
    return NextResponse.json({ error: "Décrivez le problème dans les notes" }, { status: 400 });
  }

  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { returnInspection: true } });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (reservation.status !== "confirmed" && reservation.status !== "in_progress") {
    return NextResponse.json({ error: "La réservation n'est pas en cours" }, { status: 409 });
  }
  if (reservation.returnInspection?.status === "accepted") {
    return NextResponse.json({ error: "Le retour est déjà accepté" }, { status: 409 });
  }
  if ((reservation.returnInspection?.photoPaths.length ?? 0) < 1) {
    return NextResponse.json({ error: "Ajoutez au moins une photo du problème" }, { status: 400 });
  }

  await prisma.returnInspection.update({
    where: { reservationId: id },
    data: { status: "issue", notes, inspectedByAdminId: admin.id, inspectedAt: new Date() },
  });
  await logAudit({
    action: "inspection_issue",
    reservationId: id,
    actor: { type: "admin", id: admin.id },
    details: { notes },
  });

  return NextResponse.json({ status: "issue" });
}
