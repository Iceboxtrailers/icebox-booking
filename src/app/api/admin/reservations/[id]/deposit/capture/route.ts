import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminId } from "@/lib/session";
import { getPaymentProvider } from "@/lib/providers/payment";
import { adminDepositCaptureSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getCurrentAdminId();
  if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

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

  const payment = await prisma.payment.findFirst({
    where: { reservationId: id, type: "deposit", status: "authorized" },
    orderBy: { createdAt: "desc" },
  });
  if (!payment?.transactionId) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }

  const result = await getPaymentProvider().capture(payment.transactionId, parsed.data.amountCents);
  if (result.status !== "captured") {
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

  return NextResponse.json({ depositStatus: "captured", amountCents: capturedAmount });
}
