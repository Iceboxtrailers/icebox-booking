import { randomUUID } from "node:crypto";
import type { PaymentProvider } from "./types";

// Simulates a deposit hold, mirroring the prototype's "simuler l'autorisation
// du dépôt" button. Never handles real card data. Swap for
// src/lib/providers/payment/stripe.ts (Payment Intents, manual capture) once
// a Stripe account exists — same interface, no call-site changes.
export class StubPaymentProvider implements PaymentProvider {
  async authorize({ reservationId }: { reservationId: string; amount: number }) {
    return { transactionId: `stub_${reservationId}_${randomUUID()}`, status: "authorized" as const };
  }

  async capture() {
    return { status: "captured" as const };
  }

  async release() {
    return { status: "released" as const };
  }
}
