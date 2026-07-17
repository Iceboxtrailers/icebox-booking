export const CLIENT_STATUS = ["active", "suspended", "blacklisted"] as const;
export type ClientStatus = (typeof CLIENT_STATUS)[number];

export const VERIFICATION_STATUS = ["pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUS)[number];

export const TRAILER_STATUS = ["available", "maintenance", "retired"] as const;
export type TrailerStatus = (typeof TRAILER_STATUS)[number];

export const TRAILER_SIZE = ["5x10", "6x12"] as const;
export type TrailerSize = (typeof TRAILER_SIZE)[number];

export const DATE_RANGE_TYPE = ["fixed", "flexible"] as const;
export type DateRangeType = (typeof DATE_RANGE_TYPE)[number];

export const RESERVATION_STATUS = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUS)[number];

export const DEPOSIT_STATUS = ["none", "authorized", "captured", "released"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUS)[number];

export const SIGNATURE_STATUS = ["pending", "signed"] as const;
export type SignatureStatus = (typeof SIGNATURE_STATUS)[number];

export const DOCUMENT_TYPE = ["license", "insurance"] as const;
export type DocumentType = (typeof DOCUMENT_TYPE)[number];

export const PAYMENT_TYPE = ["deposit", "rental", "refund"] as const;
export type PaymentType = (typeof PAYMENT_TYPE)[number];

export const PAYMENT_STATUS = [
  "pending",
  "authorized",
  "captured",
  "released",
  "failed",
  "refunded",
] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUS)[number];

// Flexible-date search window, in days, matching the prototype ("±2 jours").
export const FLEX_WINDOW_DAYS = 2;

// Security deposit, in cents, matching the prototype's "$250" copy.
export const DEPOSIT_AMOUNT_CENTS = 25000;
