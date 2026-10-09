import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { getPaymentProvider } from "@/lib/providers/payment";

// Booking time: save the client's card for later. No money is held here — the
// hold itself is placed just before the trailer leaves (a hold only lasts ~7 days).
export async function POST(_request: Request, { params }: { params: Promise<{ reservationId: string }> }) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { reservationId } = await params;
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { contract: true, client: true },
  });
  if (!reservation || reservation.clientId !== clientId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  if (reservation.contract?.signatureStatus !== "signed") {
    return NextResponse.json({ error: "Le contrat doit être signé avant d'enregistrer la carte" }, { status: 409 });
  }

  const { clientSecret, customerId } = await getPaymentProvider().createCardSetup({
    reservationId,
    customerId: reservation.client.stripeCustomerId,
    email: reservation.client.email,
    name: `${reservation.client.firstName} ${reservation.client.lastName}`,
  });

  if (reservation.client.stripeCustomerId !== customerId) {
    await prisma.client.update({ where: { id: clientId }, data: { stripeCustomerId: customerId } });
  }

  return NextResponse.json({ clientSecret });
}
