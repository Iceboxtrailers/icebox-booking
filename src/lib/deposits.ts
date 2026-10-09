import { prisma } from "@/lib/prisma";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";
import { logAudit, type AuditActor } from "@/lib/audit";

export function paymentProviderName(): "stripe" | "stub" {
  return process.env.STRIPE_SECRET_KEY ? "stripe" : "stub";
}

// Compare-and-set lock: only one request can move a hold from "authorized" to
// "processing", so two staff members (or a double click) can never release or
// capture the same deposit twice.
export async function lockDeposit(reservationId: string, from: string[] = ["authorized"]): Promise<boolean> {
  const { count } = await prisma.reservation.updateMany({
    where: { id: reservationId, depositStatus: { in: from } },
    data: { depositStatus: "processing" },
  });
  return count === 1;
}

export async function unlockDeposit(reservationId: string, status: string) {
  await prisma.reservation.updateMany({
    where: { id: reservationId, depositStatus: "processing" },
    data: { depositStatus: status },
  });
}

export function latestAuthorizedDepositPayment(reservationId: string) {
  return prisma.payment.findFirst({
    where: { reservationId, type: "deposit", status: "authorized" },
    orderBy: { createdAt: "desc" },
  });
}

export async function recordAuthorizedDeposit(p: {
  reservationId: string;
  transactionId: string;
  expiresAt: Date | null;
  actor: AuditActor;
  via: "off_session" | "secure_link";
}) {
  await prisma.payment.create({
    data: {
      reservationId: p.reservationId,
      provider: paymentProviderName(),
      type: "deposit",
      amount: DEPOSIT_AMOUNT_CENTS,
      status: "authorized",
      transactionId: p.transactionId,
    },
  });
  await prisma.reservation.update({
    where: { id: p.reservationId },
    data: {
      depositAmount: DEPOSIT_AMOUNT_CENTS,
      depositStatus: "authorized",
      depositExpiresAt: p.expiresAt,
      depositToken: null,
      depositTokenExpiresAt: null,
    },
  });
  await logAudit({
    action: "deposit_authorized",
    reservationId: p.reservationId,
    actor: p.actor,
    details: {
      transactionId: p.transactionId,
      amountCents: DEPOSIT_AMOUNT_CENTS,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      via: p.via,
    },
  });
}
