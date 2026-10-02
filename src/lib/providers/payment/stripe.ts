import Stripe from "stripe";
import type { PaymentProvider } from "./types";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Security deposit = a manual-capture Payment Intent: "authorize" holds the
// funds without charging them, "capture" takes the money (damage found),
// "release" cancels the hold (clean return) — exactly the three deposit
// states the rest of the app already models.
export class StripePaymentProvider implements PaymentProvider {
  async createDepositIntent({ reservationId, amount }: { reservationId: string; amount: number }) {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: "cad",
      capture_method: "manual",
      automatic_payment_methods: { enabled: true },
      metadata: { reservationId, kind: "deposit" },
    });
    if (!intent.client_secret) throw new Error("Stripe n'a pas retourné de client secret");
    return { clientSecret: intent.client_secret, transactionId: intent.id };
  }

  async confirmDeposit(transactionId: string) {
    const intent = await stripe.paymentIntents.retrieve(transactionId);
    return { status: intent.status === "requires_capture" ? ("authorized" as const) : ("failed" as const) };
  }

  async capture(transactionId: string, amountCents?: number) {
    const intent = await stripe.paymentIntents.capture(transactionId, {
      ...(amountCents !== undefined ? { amount_to_capture: amountCents } : {}),
    });
    return { status: intent.status === "succeeded" ? ("captured" as const) : ("failed" as const) };
  }

  async release(transactionId: string) {
    const intent = await stripe.paymentIntents.cancel(transactionId);
    return { status: intent.status === "canceled" ? ("released" as const) : ("failed" as const) };
  }
}
