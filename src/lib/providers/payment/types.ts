export interface PaymentProvider {
  // Creates a card hold the client confirms directly with the provider (we
  // never touch raw card data) — clientSecret mounts the provider's embedded
  // checkout UI, transactionId is what the server later confirms/captures/releases.
  createDepositIntent(p: { reservationId: string; amount: number }): Promise<{ clientSecret: string; transactionId: string }>;
  confirmDeposit(transactionId: string): Promise<{ status: "authorized" | "failed" }>;
  capture(transactionId: string): Promise<{ status: "captured" | "failed" }>;
  release(transactionId: string): Promise<{ status: "released" | "failed" }>;
}
