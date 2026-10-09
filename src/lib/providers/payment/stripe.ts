import Stripe from "stripe";
import { DEPOSIT_AUTH_FALLBACK_DAYS } from "@/lib/constants";
import type { DepositAuthorization, PaymentProvider } from "./types";

// Lazy so importing this module never throws when STRIPE_SECRET_KEY is unset
// (e.g. a prod build before the key is configured in Vercel) — the eager
// `new Stripe(...)` at module scope used to crash Next.js's "collect page
// data" step for every route that imports getPaymentProvider(), even though
// getPaymentProvider() only picks this provider once the key actually exists.
let stripeClient: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY n'est pas configuré");
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

// Stripe reports the real last moment a hold can be captured; fall back to a
// conservative window if the card network didn't provide one.
async function captureDeadline(intent: Stripe.PaymentIntent): Promise<Date | null> {
  const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
  if (!chargeId) return null;
  const charge = await getStripeClient().charges.retrieve(chargeId);
  const captureBefore = charge.payment_method_details?.card?.capture_before;
  if (captureBefore) return new Date(captureBefore * 1000);
  return new Date(Date.now() + DEPOSIT_AUTH_FALLBACK_DAYS * 24 * 60 * 60 * 1000);
}

// Security deposit = a manual-capture Payment Intent: "authorize" holds the
// funds without charging them, "capture" takes the money (damage found),
// "release" cancels the hold (clean return). Holds expire (about 7 days), so the
// card is saved at booking and the hold is placed just before handoff.
export class StripePaymentProvider implements PaymentProvider {
  async createCardSetup({
    reservationId,
    customerId,
    email,
    name,
  }: {
    reservationId: string;
    customerId: string | null;
    email: string;
    name: string;
  }) {
    const stripe = getStripeClient();
    const customer = customerId ?? (await stripe.customers.create({ email, name })).id;
    const setupIntent = await stripe.setupIntents.create({
      customer,
      usage: "off_session",
      allowed_payment_method_types: ["card"],
      metadata: { reservationId, kind: "deposit-card" },
    });
    if (!setupIntent.client_secret) throw new Error("Stripe n'a pas retourné de client secret");
    return { clientSecret: setupIntent.client_secret, customerId: customer };
  }

  async confirmCardSetup({ setupIntentId, reservationId }: { setupIntentId: string; reservationId: string }) {
    const setupIntent = await getStripeClient().setupIntents.retrieve(setupIntentId);
    const customerId = typeof setupIntent.customer === "string" ? setupIntent.customer : setupIntent.customer?.id;
    const paymentMethodId =
      typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method?.id;
    if (
      setupIntent.status !== "succeeded" ||
      setupIntent.metadata?.reservationId !== reservationId ||
      !customerId ||
      !paymentMethodId
    ) {
      return { status: "failed" as const };
    }
    return { status: "saved" as const, customerId, paymentMethodId };
  }

  async authorizeDepositOffSession({
    reservationId,
    amount,
    customerId,
    paymentMethodId,
    attempt,
  }: {
    reservationId: string;
    amount: number;
    customerId: string;
    paymentMethodId: string;
    attempt: number;
  }): Promise<DepositAuthorization> {
    const stripe = getStripeClient();
    try {
      const intent = await stripe.paymentIntents.create(
        {
          amount,
          currency: "cad",
          customer: customerId,
          payment_method: paymentMethodId,
          capture_method: "manual",
          confirm: true,
          off_session: true,
          allowed_payment_method_types: ["card"],
          metadata: { reservationId, kind: "deposit" },
        },
        // One key per attempt: a retry after a decline must not replay the old failure.
        { idempotencyKey: `deposit-auth-${reservationId}-${attempt}` },
      );
      if (intent.status === "requires_capture") {
        return { status: "authorized", transactionId: intent.id, expiresAt: await captureDeadline(intent) };
      }
      if (intent.status === "requires_action") {
        return {
          status: "requires_action",
          transactionId: intent.id,
          message: "La banque exige une confirmation du titulaire de la carte.",
        };
      }
      return { status: "failed", message: "La retenue n'a pas pu être placée." };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeCardError) {
        const intent = error.payment_intent;
        if (error.code === "authentication_required" && intent?.id) {
          return {
            status: "requires_action",
            transactionId: intent.id,
            message: "La banque exige une confirmation du titulaire de la carte.",
          };
        }
        return { status: "failed", message: error.message };
      }
      throw error;
    }
  }

  async createDepositIntent({
    reservationId,
    amount,
    customerId,
  }: {
    reservationId: string;
    amount: number;
    customerId?: string;
  }) {
    const intent = await getStripeClient().paymentIntents.create({
      amount,
      currency: "cad",
      capture_method: "manual",
      // Card only (Apple Pay / Google Pay ride on "card"): buy-now-pay-later
      // methods like Klarna/Affirm can't back a manual-capture deposit hold.
      allowed_payment_method_types: ["card"],
      ...(customerId ? { customer: customerId } : {}),
      metadata: { reservationId, kind: "deposit" },
    });
    if (!intent.client_secret) throw new Error("Stripe n'a pas retourné de client secret");
    return { clientSecret: intent.client_secret, transactionId: intent.id };
  }

  async confirmDeposit(transactionId: string, reservationId?: string) {
    const intent = await getStripeClient().paymentIntents.retrieve(transactionId);
    if (intent.status !== "requires_capture") return { status: "failed" as const, expiresAt: null };
    if (reservationId && intent.metadata?.reservationId !== reservationId) {
      return { status: "failed" as const, expiresAt: null };
    }
    return { status: "authorized" as const, expiresAt: await captureDeadline(intent) };
  }

  async capture(transactionId: string, amountCents?: number) {
    const intent = await getStripeClient().paymentIntents.capture(transactionId, {
      ...(amountCents !== undefined ? { amount_to_capture: amountCents } : {}),
    });
    return { status: intent.status === "succeeded" ? ("captured" as const) : ("failed" as const) };
  }

  async release(transactionId: string) {
    const intent = await getStripeClient().paymentIntents.cancel(transactionId);
    return { status: intent.status === "canceled" ? ("released" as const) : ("failed" as const) };
  }
}
