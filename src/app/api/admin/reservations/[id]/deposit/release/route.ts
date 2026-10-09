import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { getPaymentProvider } from "@/lib/providers/payment";
import { latestAuthorizedDepositPayment, lockDeposit, unlockDeposit } from "@/lib/deposits";
import { logAudit } from "@/lib/audit";

// Owner-only manual release, outside the inspection flow. Staff release the
// deposit through "Retour accepté", which requires the inspection photos.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;
  const { admin } = guard;

  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (reservation.depositStatus !== "authorized") {
    return NextResponse.json({ error: "Aucun dépôt autorisé à libérer" }, { status: 409 });
  }

  const payment = await latestAuthorizedDepositPayment(id);
  if (!payment?.transactionId) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }

  if (!(await lockDeposit(id))) {
    return NextResponse.json({ error: "Une autre opération est en cours sur ce dépôt" }, { status: 409 });
  }

  try {
    const result = await getPaymentProvider().release(payment.transactionId);
    if (result.status !== "released") {
      await unlockDeposit(id, "authorized");
      return NextResponse.json({ error: "Impossible de libérer le dépôt" }, { status: 502 });
    }
  } catch (error) {
    await unlockDeposit(id, "authorized");
    console.error("Deposit release error", error);
    return NextResponse.json({ error: "Impossible de libérer le dépôt" }, { status: 502 });
  }

  await prisma.payment.update({ where: { id: payment.id }, data: { status: "released" } });
  await prisma.reservation.update({ where: { id }, data: { depositStatus: "released" } });
  await logAudit({
    action: "deposit_released",
    reservationId: id,
    actor: { type: "admin", id: admin.id },
    details: { transactionId: payment.transactionId, via: "owner_manual" },
  });

  return NextResponse.json({ depositStatus: "released" });
}
