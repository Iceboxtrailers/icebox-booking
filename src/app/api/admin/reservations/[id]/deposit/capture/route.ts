import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { getPaymentProvider } from "@/lib/providers/payment";
import { adminDepositCaptureSchema } from "@/lib/validation";
import { latestAuthorizedDepositPayment, lockDeposit, unlockDeposit } from "@/lib/deposits";
import { logAudit } from "@/lib/audit";

// Charging any part of the deposit is owner-only.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;
  const { admin } = guard;

  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (reservation.depositStatus !== "authorized") {
    return NextResponse.json({ error: "Aucun dépôt autorisé à prélever" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminDepositCaptureSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  if (parsed.data.amountCents !== undefined && parsed.data.amountCents > reservation.depositAmount) {
    return NextResponse.json({ error: "Le montant dépasse le dépôt autorisé" }, { status: 400 });
  }

  const payment = await latestAuthorizedDepositPayment(id);
  if (!payment?.transactionId) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }

  if (!(await lockDeposit(id))) {
    return NextResponse.json({ error: "Une autre opération est en cours sur ce dépôt" }, { status: 409 });
  }

  let captured = false;
  try {
    const result = await getPaymentProvider().capture(payment.transactionId, parsed.data.amountCents);
    captured = result.status === "captured";
  } catch (error) {
    console.error("Deposit capture error", error);
  }
  if (!captured) {
    await unlockDeposit(id, "authorized");
    return NextResponse.json({ error: "Impossible de prélever le dépôt" }, { status: 502 });
  }

  const capturedAmount = parsed.data.amountCents ?? reservation.depositAmount;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "captured", amount: capturedAmount },
  });
  await prisma.reservation.update({
    where: { id },
    data: { depositStatus: "captured", depositAmount: capturedAmount },
  });
  await logAudit({
    action: "deposit_captured",
    reservationId: id,
    actor: { type: "admin", id: admin.id },
    details: { transactionId: payment.transactionId, amountCents: capturedAmount },
  });

  return NextResponse.json({ depositStatus: "captured", amountCents: capturedAmount });
}
