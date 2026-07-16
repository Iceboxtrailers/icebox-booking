export interface PaymentProvider {
  authorize(p: { reservationId: string; amount: number }): Promise<{ transactionId: string; status: "authorized" | "failed" }>;
  capture(transactionId: string): Promise<{ status: "captured" | "failed" }>;
  release(transactionId: string): Promise<{ status: "released" | "failed" }>;
}
