import { nights } from "@/lib/dates";
import type { TrailerSize } from "@/lib/constants";

export { nights };

export type RateTier = { dayCents: number; weekCents: number; monthCents: number };

// From "Offre de service Icebox 2026.pdf" (prices exclude tax).
export const RATE_TABLE: Record<TrailerSize, RateTier> = {
  "5x10": { dayCents: 15000, weekCents: 40000, monthCents: 90000 },
  "6x12": { dayCents: 18000, weekCents: 60000, monthCents: 130000 },
};

// Transport (delivery + pickup) and rush/urgency fees, shown to customers as
// informational text for now — not auto-calculated, since that needs a
// delivery address + distance (geocoding), which isn't collected yet.
export const TRANSPORT_FEE_PER_TRIP_CENTS = 6000; // per one-way trip, first 50km
export const TRANSPORT_FEE_PER_KM_BEYOND_CENTS = 95; // per km beyond 50km
export const URGENCY_FEE_PER_KM_CENTS = 125;
export const URGENCY_FEE_PER_HOUR_CENTS = 10000;
export const URGENCY_MIN_HOURS = 3;

export type PriceBreakdown = { months: number; weeks: number; days: number; totalCents: number };

// The offer sheet gives flat rates for exactly 1 day / 7 days / 30 days, not
// a continuous per-day formula. For an arbitrary date range we decompose the
// night count into month/week/day blocks and price each block at its tier —
// the same way multi-tier rental pricing commonly works.
export function priceBreakdown(size: TrailerSize, start: string, end: string): PriceBreakdown {
  const rate = RATE_TABLE[size];
  const totalNights = nights(start, end);

  const months = Math.floor(totalNights / 30);
  const afterMonths = totalNights % 30;
  const weeks = Math.floor(afterMonths / 7);
  const days = afterMonths % 7;

  const totalCents = months * rate.monthCents + weeks * rate.weekCents + days * rate.dayCents;
  return { months, weeks, days, totalCents };
}

export function computeTotalCents(size: TrailerSize, start: string, end: string): number {
  return priceBreakdown(size, start, end).totalCents;
}
