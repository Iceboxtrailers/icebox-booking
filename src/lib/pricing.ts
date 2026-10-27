import { nights } from "@/lib/dates";
import type { TrailerSize } from "@/lib/constants";

export { nights };

export type RateTier = { dayCents: number; weekCents: number; monthCents: number };

// From "Offre de service Icebox 2026.pdf" (prices exclude tax).
export const RATE_TABLE: Record<TrailerSize, RateTier> = {
  "5x10": { dayCents: 15000, weekCents: 40000, monthCents: 90000 },
  "6x12": { dayCents: 18000, weekCents: 60000, monthCents: 130000 },
};

// Transport (delivery + pickup) is auto-calculated from the driving distance
// (see computeDeliveryFeeCents). Rush/urgency fees are informational only.
export const TRANSPORT_FEE_PER_TRIP_CENTS = 6000; // per one-way trip, first 50km
export const TRANSPORT_FEE_PER_KM_BEYOND_CENTS = 95; // per km beyond 50km
export const TRANSPORT_INCLUDED_KM = 50;

// distanceKm is the one-way driving distance from the depot; trips is 2 for
// delivery + pickup, 1 for a one-way request.
export function computeDeliveryFeeCents(distanceKm: number, trips: number): number {
  const beyondKm = Math.max(0, distanceKm - TRANSPORT_INCLUDED_KM);
  const perTripCents = TRANSPORT_FEE_PER_TRIP_CENTS + Math.round(beyondKm * TRANSPORT_FEE_PER_KM_BEYOND_CENTS);
  return perTripCents * trips;
}

export const URGENCY_FEE_PER_KM_CENTS = 125;
export const URGENCY_FEE_PER_HOUR_CENTS = 10000;
export const URGENCY_MIN_HOURS = 3;

// Longer rentals are arranged directly with IceBox, not through the online wizard.
export const MAX_ONLINE_RENTAL_NIGHTS = 365;

// The owner's long-stay rule (it is not in the offer sheet): the days after the full months of one continuous rental cost
// the monthly rate spread over 28 days, so a week costs a quarter of a month.
export const LONG_STAY_SPREAD_DAYS = 28;

// What `days` days cost after the full months of a long stay: their share of the monthly rate, rounded to the cent once for
// the whole block (5 days of a 6x12 are 232,14 $, not 5 x 46,43 $), and never more than one more month.
export function longStayCents(size: TrailerSize, days: number): number {
  const { monthCents } = RATE_TABLE[size];
  return Math.min(Math.round((days * monthCents) / LONG_STAY_SPREAD_DAYS), monthCents);
}

// `longStayDays` are the days after the full months of a long stay; they are priced by longStayCents, not as weeks and days.
export type PriceBreakdown = { months: number; weeks: number; days: number; longStayDays: number; totalCents: number };

// The offer sheet gives flat rates for exactly 1 day / 7 days / 30 days, not
// a continuous per-day formula. For an arbitrary date range we decompose the
// night count into month/week/day blocks and price each block at its tier.
// A block never costs more than the next tier up (best price for the client):
// e.g. 4 days of a 5x10 are billed as one week (400 $), not 4 x 150 $.
//
// A rental of 30 nights or more is a long stay: each full block of 30 nights costs the monthly rate and the days after
// them are priced by longStayCents. It takes one continuous rental: separate reservations are each priced on their own
// nights and never added up, however close they are.
export function priceBreakdown(size: TrailerSize, start: string, end: string): PriceBreakdown {
  const rate = RATE_TABLE[size];
  const totalNights = nights(start, end);

  let months = Math.floor(totalNights / 30);
  const afterMonths = totalNights % 30;

  if (months > 0) {
    const longStayDays = afterMonths;
    const longStay = longStayCents(size, longStayDays);
    // 28 days or more after the full months are one more month.
    if (longStay >= rate.monthCents) {
      months += 1;
      return { months, weeks: 0, days: 0, longStayDays: 0, totalCents: months * rate.monthCents };
    }
    return { months, weeks: 0, days: 0, longStayDays, totalCents: months * rate.monthCents + longStay };
  }

  let weeks = Math.floor(afterMonths / 7);
  let days = afterMonths % 7;

  if (days * rate.dayCents >= rate.weekCents) {
    weeks += 1;
    days = 0;
  }
  if (weeks * rate.weekCents + days * rate.dayCents >= rate.monthCents) {
    months += 1;
    weeks = 0;
    days = 0;
  }

  const totalCents = months * rate.monthCents + weeks * rate.weekCents + days * rate.dayCents;
  return { months, weeks, days, longStayDays: 0, totalCents };
}

export function computeTotalCents(size: TrailerSize, start: string, end: string): number {
  return priceBreakdown(size, start, end).totalCents;
}

// Current Québec rates (TPS fédérale + TVQ provinciale), both computed on the
// pre-tax subtotal — not compounded, per the method in effect since 2013.
export const GST_RATE = 0.05;
export const QST_RATE = 0.09975;

export type TaxBreakdown = {
  subtotalCents: number;
  gstCents: number;
  qstCents: number;
  totalWithTaxCents: number;
};

export function computeTaxBreakdown(subtotalCents: number): TaxBreakdown {
  const gstCents = Math.round(subtotalCents * GST_RATE);
  const qstCents = Math.round(subtotalCents * QST_RATE);
  return { subtotalCents, gstCents, qstCents, totalWithTaxCents: subtotalCents + gstCents + qstCents };
}
