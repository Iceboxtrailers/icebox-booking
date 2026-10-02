import { randomUUID } from "node:crypto";
import type { PaymentProvider } from "./types";

// Used only when STRIPE_SECRET_KEY isn't set (e.g. a fresh local clone).
// Never handles real card data — the frontend shows a "paiement non
// configuré" message instead of mounting real Stripe Elements in that case.
export class StubPaymentProvider implements PaymentProvider {
  async createDepositIntent({ reservationId }: { reservationId: string; amount: number }) {
    const transactionId = `stub_${reservationId}_${randomUUID()}`;
    return { clientSecret: `stub_secret_${transactionId}`, transactionId };
  }

  async confirmDeposit() {
    return { status: "authorized" as const };
  }

  async capture() {
    return { status: "captured" as const };
  }

  async release() {
    return { status: "released" as const };
  }
}
