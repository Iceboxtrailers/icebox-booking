import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getPaymentProvider } from "@/lib/providers/payment";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";
import { adminDepositAuthorizeSchema } from "@/lib/validation";
import { latestAuthorizedDepositPayment, lockDeposit, recordAuthorizedDeposit, unlockDeposit } from "@/lib/deposits";
import { logAudit } from "@/lib/audit";

// Places the deposit hold on the card saved at booking, just before handoff
// (or renews a hold that would expire before the trailer is back).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const { admin } = guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminDepositAuthorizeSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const renew = parsed.data.renew === true;

  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { client: true } });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (reservation.status !== "confirmed" && reservation.status !== "in_progress") {
    return NextResponse.json({ error: "La réservation doit être confirmée" }, { status: 409 });
  }

  const previousStatus = reservation.depositStatus;
  if (previousStatus === "authorized" && !renew) {
    return NextResponse.json({ error: "Une retenue est déjà active" }, { status: 409 });
  }
  if (!["card_on_file", "expired", "authorized"].includes(previousStatus)) {
    return NextResponse.json(
      { error: "Aucune carte enregistrée pour cette réservation — utilisez le lien de paiement", canSendLink: true },
      { status: 409 },
    );
  }
  if (!reservation.client.stripeCustomerId || !reservation.stripePaymentMethodId) {
    return NextResponse.json(
      { error: "Aucune carte enregistrée pour cette réservation — utilisez le lien de paiement", canSendLink: true },
      { status: 409 },
    );
  }

  const previousPayment = previousStatus === "authorized" ? await latestAuthorizedDepositPayment(id) : null;

  // Only one request may move the hold into "processing" — blocks double clicks
  // and two staff members acting at once.
  if (!(await lockDeposit(id, [previousStatus]))) {
    return NextResponse.json({ error: "Une autre opération est en cours sur ce dépôt" }, { status: 409 });
  }

  const provider = getPaymentProvider();
  try {
    const attempt = await prisma.payment.count({ where: { reservationId: id, type: "deposit" } });
    const result = await provider.authorizeDepositOffSession({
      reservationId: id,
      amount: DEPOSIT_AMOUNT_CENTS,
      customerId: reservation.client.stripeCustomerId,
      paymentMethodId: reservation.stripePaymentMethodId,
      attempt,
    });

    if (result.status === "authorized") {
      await recordAuthorizedDeposit({
        reservationId: id,
        transactionId: result.transactionId,
        expiresAt: result.expiresAt,
        actor: { type: "admin", id: admin.id },
        via: "off_session",
      });

      if (previousPayment?.transactionId) {
        const released = await provider.release(previousPayment.transactionId).catch(() => ({ status: "failed" as const }));
        if (released.status === "released") {
          await prisma.payment.update({ where: { id: previousPayment.id }, data: { status: "released" } });
        } else {
          await logAudit({
            action: "deposit_renew_old_hold_not_released",
            reservationId: id,
            actor: { type: "admin", id: admin.id },
            details: { transactionId: previousPayment.transactionId },
          });
        }
      }

      return NextResponse.json({
        depositStatus: "authorized",
        depositAmount: DEPOSIT_AMOUNT_CENTS,
        depositExpiresAt: result.expiresAt?.toISOString() ?? null,
      });
    }

    await unlockDeposit(id, previousStatus);
    if (result.status === "requires_action") {
      await provider.release(result.transactionId).catch(() => undefined);
    }
    await logAudit({
      action: "deposit_authorize_failed",
      reservationId: id,
      actor: { type: "admin", id: admin.id },
      details: { reason: result.status, message: result.message },
    });
    return NextResponse.json(
      { error: result.message, canSendLink: true, requiresAction: result.status === "requires_action" },
      { status: 402 },
    );
  } catch (error) {
    await unlockDeposit(id, previousStatus);
    console.error("Deposit authorization error", error);
    return NextResponse.json({ error: "Erreur lors de la retenue du dépôt" }, { status: 502 });
  }
}
