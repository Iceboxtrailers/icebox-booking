import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/providers/payment";
import { depositAuthorizeSchema } from "@/lib/validation";
import { findReservationByDepositToken } from "@/lib/deposit-link";
import { latestAuthorizedDepositPayment, lockDeposit, recordAuthorizedDeposit } from "@/lib/deposits";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reservation = await findReservationByDepositToken(token);
  if (!reservation) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = depositAuthorizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { transactionId } = parsed.data;

  const provider = getPaymentProvider();
  // Re-check with the provider (and that the hold belongs to this reservation)
  // before trusting the browser's claim that it succeeded.
  const result = await provider.confirmDeposit(transactionId, reservation.id);
  if (result.status !== "authorized") {
    return NextResponse.json({ error: "Le dépôt n'a pas pu être autorisé" }, { status: 402 });
  }

  const previousStatus = reservation.depositStatus;
  const allowed = ["none", "card_on_file", "expired", "authorized"];
  const locked = allowed.includes(previousStatus) && (await lockDeposit(reservation.id, [previousStatus]));
  if (!locked) {
    // Don't leave a hold on the client's card that the system won't track.
    await provider.release(transactionId).catch(() => undefined);
    return NextResponse.json({ error: "Aucune retenue à placer pour le moment" }, { status: 409 });
  }

  const previousPayment = previousStatus === "authorized" ? await latestAuthorizedDepositPayment(reservation.id) : null;

  await recordAuthorizedDeposit({
    reservationId: reservation.id,
    transactionId,
    expiresAt: result.expiresAt,
    actor: { type: "client", id: reservation.clientId },
    via: "secure_link",
  });

  if (previousPayment?.transactionId && previousPayment.transactionId !== transactionId) {
    const released = await provider.release(previousPayment.transactionId).catch(() => ({ status: "failed" as const }));
    if (released.status === "released") {
      await prisma.payment.update({ where: { id: previousPayment.id }, data: { status: "released" } });
    }
  }

  return NextResponse.json({ depositStatus: "authorized" });
}
