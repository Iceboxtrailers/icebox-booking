import { StubPaymentProvider } from "./stub";
import type { PaymentProvider } from "./types";

export type { PaymentProvider };

let instance: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!instance) {
    instance = new StubPaymentProvider();
  }
  return instance;
}
