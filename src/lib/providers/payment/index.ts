import { StubPaymentProvider } from "./stub";
import { StripePaymentProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export type { PaymentProvider };

let instance: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!instance) {
    instance = process.env.STRIPE_SECRET_KEY ? new StripePaymentProvider() : new StubPaymentProvider();
  }
  return instance;
}
