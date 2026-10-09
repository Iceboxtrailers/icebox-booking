import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { getPaymentProvider } from "@/lib/providers/payment";
import { cardSavedSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

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
    return NextResponse.json({ error: "Le contrat doit être signé avant d'enregistrer la carte" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = cardSavedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  // The browser talks to Stripe directly (card data never touches our server) —
  // re-check the setup with the provider before trusting the client's claim.
  const result = await getPaymentProvider().confirmCardSetup({
    setupIntentId: parsed.data.setupIntentId,
    reservationId,
  });
  if (result.status !== "saved") {
    return NextResponse.json({ error: "La carte n'a pas pu être enregistrée" }, { status: 402 });
  }

  await prisma.client.update({ where: { id: clientId }, data: { stripeCustomerId: result.customerId } });

  // Never downgrade a hold that is already active.
  const keepStatus = ["authorized", "processing", "captured"].includes(reservation.depositStatus);
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      stripePaymentMethodId: result.paymentMethodId,
      ...(keepStatus ? {} : { depositStatus: "card_on_file" }),
    },
  });
  await logAudit({
    action: "card_saved",
    reservationId,
    actor: { type: "client", id: clientId },
    details: { paymentMethodId: result.paymentMethodId },
  });

  return NextResponse.json({ depositStatus: keepStatus ? reservation.depositStatus : "card_on_file" });
}
