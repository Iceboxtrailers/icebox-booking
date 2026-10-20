import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { VERIFICATION_STATUS } from "@/lib/constants";

const schema = z.object({
  verificationStatus: z.enum(VERIFICATION_STATUS),
  // The booking the staff member was looking at, only to attribute the audit entry.
  reservationId: z.string().min(1).max(60).optional(),
});

// Staff mark an uploaded licence or insurance proof as checked, refused, or back to "to check".
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { verificationStatus, reservationId } = parsed.data;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (document.verificationStatus !== verificationStatus) {
    await prisma.document.update({ where: { id }, data: { verificationStatus } });

    // Only attach the booking if it really belongs to this client.
    const reservation = reservationId
      ? await prisma.reservation.findFirst({ where: { id: reservationId, clientId: document.clientId }, select: { id: true } })
      : null;
    await logAudit({
      action: "document_verification",
      reservationId: reservation?.id ?? null,
      actor: { type: "admin", id: guard.admin.id },
      details: { documentId: id, clientId: document.clientId, type: document.type, from: document.verificationStatus, to: verificationStatus },
    });
  }

  return NextResponse.json({ id, verificationStatus });
}
