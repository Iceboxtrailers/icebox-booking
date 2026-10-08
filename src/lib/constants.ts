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

// pickup = customer comes to the depot both ways; delivery = we deliver and collect
// (2 one-way trips); delivery_only / return_only = a single trip.
export const DELIVERY_OPTION = ["pickup", "delivery", "delivery_only", "return_only"] as const;
export type DeliveryOption = (typeof DELIVERY_OPTION)[number];

export const DELIVERY_OPTION_LABEL_FR: Record<DeliveryOption, string> = {
  pickup: "Ramassage au dépôt (Lévis)",
  delivery: "Livraison et récupération",
  delivery_only: "Livraison seulement",
  return_only: "Récupération seulement",
};

export function deliveryTrips(option: DeliveryOption): number {
  if (option === "delivery") return 2;
  if (option === "delivery_only" || option === "return_only") return 1;
  return 0;
}

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
