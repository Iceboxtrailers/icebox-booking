import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getPaymentProvider } from "@/lib/providers/payment";
import { MIN_INSPECTION_PHOTOS } from "@/lib/constants";
import { adminInspectionSchema } from "@/lib/validation";
import { latestAuthorizedDepositPayment, lockDeposit, unlockDeposit } from "@/lib/deposits";
import { logAudit } from "@/lib/audit";

// "Retour accepté": validates the inspection (photos required) and releases the
// deposit hold. The deposit is only ever released after photos exist.
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

  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { returnInspection: true } });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (reservation.status !== "confirmed" && reservation.status !== "in_progress") {
    return NextResponse.json({ error: "La réservation n'est pas en cours" }, { status: 409 });
  }

  const inspection = reservation.returnInspection;
  if (inspection?.status === "accepted") {
    return NextResponse.json({ error: "Le retour est déjà accepté" }, { status: 409 });
  }
  if (inspection?.status === "issue" && admin.role !== "owner") {
    return NextResponse.json({ error: "Un problème a été signalé : décision du propriétaire requise" }, { status: 403 });
  }
  const photoCount = inspection?.photoPaths.length ?? 0;
  if (photoCount < MIN_INSPECTION_PHOTOS) {
    return NextResponse.json(
      { error: `Au moins ${MIN_INSPECTION_PHOTOS} photos sont requises (${photoCount} enregistrée${photoCount > 1 ? "s" : ""})` },
      { status: 400 },
    );
  }

  let releasedTransactionId: string | null = null;
  if (reservation.depositStatus === "processing") {
    return NextResponse.json({ error: "Une autre opération est en cours sur ce dépôt" }, { status: 409 });
  }
  if (reservation.depositStatus === "authorized") {
    const payment = await latestAuthorizedDepositPayment(id);
    if (!payment?.transactionId) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    if (!(await lockDeposit(id))) {
      return NextResponse.json({ error: "Une autre opération est en cours sur ce dépôt" }, { status: 409 });
    }
    let released = false;
    try {
      released = (await getPaymentProvider().release(payment.transactionId)).status === "released";
    } catch (error) {
      console.error("Deposit release error", error);
    }
    if (!released) {
      await unlockDeposit(id, "authorized");
      return NextResponse.json({ error: "Impossible de libérer le dépôt — le retour n'a pas été accepté" }, { status: 502 });
    }
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "released" } });
    await prisma.reservation.update({ where: { id }, data: { depositStatus: "released" } });
    releasedTransactionId = payment.transactionId;
  }

  const now = new Date();
  await prisma.returnInspection.update({
    where: { reservationId: id },
    data: {
      status: "accepted",
      notes: parsed.data.notes || inspection?.notes || null,
      inspectedByAdminId: admin.id,
      inspectedAt: now,
      depositReleasedAt: releasedTransactionId ? now : null,
    },
  });
  await prisma.reservation.update({ where: { id }, data: { status: "completed" } });

  await logAudit({
    action: "inspection_accepted",
    reservationId: id,
    actor: { type: "admin", id: admin.id },
    details: { photoCount, depositReleased: Boolean(releasedTransactionId) },
  });
  if (releasedTransactionId) {
    await logAudit({
      action: "deposit_released",
      reservationId: id,
      actor: { type: "admin", id: admin.id },
      details: { transactionId: releasedTransactionId, via: "inspection_accepted" },
    });
  }

  return NextResponse.json({
    status: "completed",
    depositStatus: releasedTransactionId ? "released" : reservation.depositStatus,
  });
}
