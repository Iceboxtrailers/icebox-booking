import { prisma } from "@/lib/prisma";
import { addDays, nights } from "@/lib/dates";
import { computeTotalCents } from "@/lib/pricing";
import { catalogueFor, findCatalogueModel } from "@/lib/catalogue";
import type { DateRangeType, TrailerSize, TrailerType } from "@/lib/constants";

export type AvailabilityWindow = { start: string; end: string; offsetDays: number };

export type AvailabilityCandidate = {
  trailerId: string;
  model: string;
  type: TrailerType;
  size: TrailerSize;
  tempRange: string;
  dailyRateCents: number;
  windowStart: string;
  windowEnd: string;
  nights: number;
  totalCents: number;
};

export function buildWindows(
  dateRangeType: DateRangeType,
  start: string,
  end: string,
  flexWindowDays: number
): AvailabilityWindow[] {
  if (dateRangeType === "fixed" || flexWindowDays <= 0) {
    return [{ start, end, offsetDays: 0 }];
  }
  return [-flexWindowDays, 0, flexWindowDays].map((offset) => ({
    start: addDays(start, offset),
    end: addDays(end, offset),
    offsetDays: offset,
  }));
}

// Two date ranges (end-exclusive, "return morning" convention) overlap when
// existingStart < candidateEnd && candidateStart < existingEnd.
async function hasConflict(
  trailerId: string,
  windowStart: string,
  windowEnd: string,
  excludeReservationId?: string
) {
  const conflict = await prisma.reservation.findFirst({
    where: {
      trailerId,
      status: { not: "cancelled" },
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      pickupDate: { lt: new Date(`${windowEnd}T00:00:00Z`) },
      returnDate: { gt: new Date(`${windowStart}T00:00:00Z`) },
    },
    select: { id: true },
  });
  return Boolean(conflict);
}

export async function searchAvailability(input: {
  type: TrailerType;
  size: TrailerSize;
  dateRangeType: DateRangeType;
  start: string;
  end: string;
  flexWindowDays: number;
  excludeReservationId?: string;
}): Promise<AvailabilityCandidate[]> {
  const models = catalogueFor(input.type, input.size);
  if (models.length === 0) return [];

  const trailers = await prisma.trailer.findMany({
    where: {
      type: input.type,
      size: input.size,
      status: "available",
    },
  });

  const windows = buildWindows(input.dateRangeType, input.start, input.end, input.flexWindowDays);
  const candidates: AvailabilityCandidate[] = [];

  for (const trailer of trailers) {
    const meta = findCatalogueModel(trailer.model);
    for (const w of windows) {
      const conflicting = await hasConflict(trailer.id, w.start, w.end, input.excludeReservationId);
      if (conflicting) continue;

      candidates.push({
        trailerId: trailer.id,
        model: trailer.model,
        type: input.type,
        size: input.size,
        tempRange: meta?.tempRange ?? "",
        dailyRateCents: trailer.dailyRate,
        windowStart: w.start,
        windowEnd: w.end,
        nights: nights(w.start, w.end),
        totalCents: computeTotalCents(trailer.dailyRate, w.start, w.end),
      });
    }
  }

  return candidates;
}

export { hasConflict };
