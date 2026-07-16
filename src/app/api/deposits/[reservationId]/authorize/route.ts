import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { getPaymentProvider } from "@/lib/providers/payment";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";

export async function POST(_request: Request, { params }: { params: Promise<{ reservationId: string }> }) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { reservationId } = await params;
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { contract: true },
  });
  if (!reservation || reservation.clientId !== clientId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  if (reservation.contract?.signatureStatus !== "signed") {
    return NextResponse.json({ error: "Le contrat doit être signé avant d'autoriser le dépôt" }, { status: 409 });
  }

  const result = await getPaymentProvider().authorize({
    reservationId,
    amount: DEPOSIT_AMOUNT_CENTS,
  });

  await prisma.payment.create({
    data: {
      reservationId,
      type: "deposit",
      amount: DEPOSIT_AMOUNT_CENTS,
      status: result.status,
      transactionId: result.transactionId,
    },
  });

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { depositAmount: DEPOSIT_AMOUNT_CENTS, depositStatus: "authorized" },
  });

  return NextResponse.json({ depositStatus: "authorized" });
}
