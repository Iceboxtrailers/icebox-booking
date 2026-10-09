import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/providers/payment";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";
import { findReservationByDepositToken } from "@/lib/deposit-link";

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reservation = await findReservationByDepositToken(token);
  if (!reservation) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });

  const { clientSecret, transactionId } = await getPaymentProvider().createDepositIntent({
    reservationId: reservation.id,
    amount: DEPOSIT_AMOUNT_CENTS,
    customerId: reservation.client.stripeCustomerId ?? undefined,
  });

  return NextResponse.json({ clientSecret, transactionId });
}
