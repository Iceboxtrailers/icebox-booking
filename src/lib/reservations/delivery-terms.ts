import type { DeliveryOption } from "@/lib/constants";

export type DeliveryTerms = {
  deliveryOption: DeliveryOption;
  usageLocation: string | null;
  deliveryFeeCents: number;
  deliveryDistanceKm: number | null;
};

type StoredTerms = DeliveryTerms & { totalAmount: number };

export const NO_DELIVERY: StoredTerms = {
  deliveryOption: "pickup",
  usageLocation: null,
  deliveryFeeCents: 0,
  deliveryDistanceKm: null,
  totalAmount: 0,
};

// What the console can set about getting the trailer to the client: how it travels, where it goes and what the
// transport costs. Whatever the request leaves out stays as it is stored. The fee is part of the total (both are
// before taxes), so it can never exceed it, and a booking picked up at the depot has no transport fee.
export function resolveDeliveryTerms(
  stored: StoredTerms,
  input: { deliveryOption?: DeliveryOption; usageLocation?: string; deliveryFeeCents?: number; totalAmount?: number },
): { ok: true; terms: DeliveryTerms; changed: boolean } | { ok: false; error: string } {
  const deliveryOption = input.deliveryOption ?? stored.deliveryOption;
  const usageLocation = input.usageLocation !== undefined ? input.usageLocation.trim() || null : stored.usageLocation;
  const deliveryFeeCents = deliveryOption === "pickup" ? 0 : (input.deliveryFeeCents ?? stored.deliveryFeeCents);
  const totalAmount = input.totalAmount ?? stored.totalAmount;

  if (deliveryOption !== "pickup" && !usageLocation) return { ok: false, error: "Adresse de livraison requise" };
  if (deliveryFeeCents > totalAmount) return { ok: false, error: "Les frais de transport dépassent le montant total" };

  const changed =
    deliveryOption !== stored.deliveryOption || usageLocation !== stored.usageLocation || deliveryFeeCents !== stored.deliveryFeeCents;
  return {
    ok: true,
    changed,
    // A distance worked out for an earlier address or price says nothing about the new one.
    terms: { deliveryOption, usageLocation, deliveryFeeCents, deliveryDistanceKm: changed ? null : stored.deliveryDistanceKm },
  };
}

// The transport is charged on top of the rental, so when its fee changes the total moves by the same amount and the
// rental price stays where it was (1 950 $ of rental + 490 $ of transport is 2 440 $).
export function totalAfterFeeChange(totalCents: number, oldFeeCents: number, newFeeCents: number): number {
  return Math.max(0, totalCents + newFeeCents - oldFeeCents);
}
