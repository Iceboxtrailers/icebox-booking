export type DepositAuthorization =
  | { status: "authorized"; transactionId: string; expiresAt: Date | null }
  // The bank wants the cardholder present (3-D Secure) — fall back to the secure link.
  | { status: "requires_action"; transactionId: string; message: string }
  | { status: "failed"; message: string };

export interface PaymentProvider {
  // Booking time: saves the card for later (no money held yet). clientSecret
  // mounts the provider's embedded form — we never touch raw card data.
  createCardSetup(p: {
    reservationId: string;
    customerId: string | null;
    email: string;
    name: string;
  }): Promise<{ clientSecret: string; customerId: string }>;
  confirmCardSetup(p: {
    setupIntentId: string;
    reservationId: string;
  }): Promise<{ status: "saved"; customerId: string; paymentMethodId: string } | { status: "failed" }>;

  // Just before handoff: holds the deposit on the saved card, no cardholder present.
  authorizeDepositOffSession(p: {
    reservationId: string;
    amount: number;
    customerId: string;
    paymentMethodId: string;
    attempt: number;
  }): Promise<DepositAuthorization>;

  // On-session fallback (secure link): a hold the client confirms in their browser.
  createDepositIntent(p: {
    reservationId: string;
    amount: number;
    customerId?: string;
  }): Promise<{ clientSecret: string; transactionId: string }>;
  // reservationId, when given, must match the hold's metadata (ownership check).
  confirmDeposit(
    transactionId: string,
    reservationId?: string,
  ): Promise<{ status: "authorized" | "failed"; expiresAt: Date | null }>;

  // amountCents lets the admin capture less than the full hold (e.g. a
  // cleaning fee) instead of the whole deposit — omit it to capture it all.
  capture(transactionId: string, amountCents?: number): Promise<{ status: "captured" | "failed" }>;
  release(transactionId: string): Promise<{ status: "released" | "failed" }>;
}
