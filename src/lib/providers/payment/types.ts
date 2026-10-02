export interface PaymentProvider {
  // Creates a card hold the client confirms directly with the provider (we
  // never touch raw card data) — clientSecret mounts the provider's embedded
  // checkout UI, transactionId is what the server later confirms/captures/releases.
  createDepositIntent(p: { reservationId: string; amount: number }): Promise<{ clientSecret: string; transactionId: string }>;
  confirmDeposit(transactionId: string): Promise<{ status: "authorized" | "failed" }>;
  // amountCents lets the admin capture less than the full hold (e.g. a
  // cleaning fee) instead of the whole deposit — omit it to capture it all.
  capture(transactionId: string, amountCents?: number): Promise<{ status: "captured" | "failed" }>;
  release(transactionId: string): Promise<{ status: "released" | "failed" }>;
}
