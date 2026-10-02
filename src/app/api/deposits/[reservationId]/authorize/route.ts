import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { getPaymentProvider } from "@/lib/providers/payment";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";
import { depositAuthorizeSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ reservationId: string }> }) {
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

  const body = await request.json().catch(() => null);
  const parsed = depositAuthorizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { transactionId } = parsed.data;

  // The client only ever talks to Stripe directly (card data never touches
  // our server) — this re-checks the hold's status with the provider itself
  // before trusting the client's claim that it succeeded.
  const result = await getPaymentProvider().confirmDeposit(transactionId);
  if (result.status !== "authorized") {
    return NextResponse.json({ error: "Le dépôt n'a pas pu être autorisé" }, { status: 402 });
  }

  await prisma.payment.create({
    data: {
      reservationId,
      type: "deposit",
      amount: DEPOSIT_AMOUNT_CENTS,
      status: result.status,
      transactionId,
    },
  });

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { depositAmount: DEPOSIT_AMOUNT_CENTS, depositStatus: "authorized" },
  });

  return NextResponse.json({ depositStatus: "authorized" });
}
