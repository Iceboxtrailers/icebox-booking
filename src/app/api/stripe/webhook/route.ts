import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

// Keeps the app in sync with what happens on Stripe's side: a hold that lapsed,
// a hold cancelled or captured from the Stripe dashboard. Each handler is a
// compare-and-set on the current state, so a replayed event changes nothing.
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = new Stripe(secretKey).webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  switch (event.type) {
    case "charge.expired": {
      const charge = event.data.object;
      const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (intentId) await closeAuthorizedHold(intentId, "expired", event.id);
      break;
    }
    case "payment_intent.canceled": {
      const intent = event.data.object;
      const lapsed = intent.cancellation_reason === "automatic";
      await closeAuthorizedHold(intent.id, lapsed ? "expired" : "released", event.id);
      break;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object;
      await markCapturedFromStripe(intent.id, intent.amount_received, event.id);
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      const reservationId = intent.metadata?.reservationId;
      if (reservationId) {
        await logAudit({
          action: "deposit_payment_failed",
          reservationId,
          actor: { type: "stripe" },
          details: { eventId: event.id, transactionId: intent.id, message: intent.last_payment_error?.message ?? null },
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function closeAuthorizedHold(transactionId: string, outcome: "expired" | "released", eventId: string) {
  const payment = await prisma.payment.findFirst({
    where: { transactionId, type: "deposit", status: "authorized" },
  });
  if (!payment) return; // already handled, replaced, or not one of ours

  // Only act while the deposit still reads "authorized": during our own
  // release/capture the status is "processing", so we never race ourselves.
  const { count } = await prisma.reservation.updateMany({
    where: { id: payment.reservationId, depositStatus: "authorized" },
    data: { depositStatus: outcome },
  });
  if (count !== 1) return;

  await prisma.payment.update({ where: { id: payment.id }, data: { status: outcome } });
  await logAudit({
    action: outcome === "expired" ? "deposit_expired" : "deposit_released_externally",
    reservationId: payment.reservationId,
    actor: { type: "stripe" },
    details: { eventId, transactionId },
  });
}

async function markCapturedFromStripe(transactionId: string, amountReceived: number, eventId: string) {
  const payment = await prisma.payment.findFirst({
    where: { transactionId, type: "deposit", status: "authorized" },
  });
  if (!payment) return;

  const { count } = await prisma.reservation.updateMany({
    where: { id: payment.reservationId, depositStatus: "authorized" },
    data: { depositStatus: "captured", depositAmount: amountReceived },
  });
  if (count !== 1) return;

  await prisma.payment.update({ where: { id: payment.id }, data: { status: "captured", amount: amountReceived } });
  await logAudit({
    action: "deposit_captured_externally",
    reservationId: payment.reservationId,
    actor: { type: "stripe" },
    details: { eventId, transactionId, amountCents: amountReceived },
  });
}
