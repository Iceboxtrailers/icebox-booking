import { randomUUID } from "node:crypto";
import type { PaymentProvider } from "./types";

// Used only when STRIPE_SECRET_KEY isn't set (e.g. a fresh local clone).
// Never handles real card data — the frontend shows a "paiement non
// configuré" message instead of mounting real Stripe Elements in that case.
export class StubPaymentProvider implements PaymentProvider {
  async createCardSetup({ reservationId }: { reservationId: string }) {
    const id = `stub_${reservationId}_${randomUUID()}`;
    return { clientSecret: `stub_secret_${id}`, customerId: `stub_customer_${reservationId}` };
  }

  async confirmCardSetup({ reservationId }: { setupIntentId: string; reservationId: string }) {
    return {
      status: "saved" as const,
      customerId: `stub_customer_${reservationId}`,
      paymentMethodId: `stub_pm_${reservationId}`,
    };
  }

  async authorizeDepositOffSession({ reservationId, attempt }: { reservationId: string; attempt: number }) {
    return {
      status: "authorized" as const,
      transactionId: `stub_${reservationId}_${attempt}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  async createDepositIntent({ reservationId }: { reservationId: string; amount: number }) {
    const transactionId = `stub_${reservationId}_${randomUUID()}`;
    return { clientSecret: `stub_secret_${transactionId}`, transactionId };
  }

  async confirmDeposit() {
    return { status: "authorized" as const, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
  }

  async capture() {
    return { status: "captured" as const };
  }

  async release() {
    return { status: "released" as const };
  }
}
