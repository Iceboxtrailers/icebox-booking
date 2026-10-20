import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, nights, quebecDay } from "@/lib/dates";
import { computeTotalCents } from "@/lib/pricing";
import { catalogueFor } from "@/lib/catalogue";
import { SLOT_HOLDING_STATUSES, TRAILER_SIZE } from "@/lib/constants";
import type { DateRangeType, TrailerSize } from "@/lib/constants";

export type AvailabilityWindow = { start: string; end: string; offsetDays: number };

export type AvailabilityCandidate = {
  trailerId: string;
  size: TrailerSize;
  tempRangeLabel: string;
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

type ReservationDb = Pick<Prisma.TransactionClient, "reservation">;

// Two date ranges (end-exclusive, "return morning" convention) overlap when
// existingStart < candidateEnd && candidateStart < existingEnd. Only bookings that hold their trailer
// count (see SLOT_HOLDING_STATUSES): an unfinished booking never blocks anyone.
async function hasConflict(
  trailerId: string,
  windowStart: string,
  windowEnd: string,
  excludeReservationId?: string,
  db: ReservationDb = prisma
) {
  const conflict = await db.reservation.findFirst({
    where: {
      trailerId,
      status: { in: [...SLOT_HOLDING_STATUSES] },
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      pickupDate: { lt: new Date(`${windowEnd}T00:00:00Z`) },
      returnDate: { gt: new Date(`${windowStart}T00:00:00Z`) },
    },
    select: { id: true },
  });
  return Boolean(conflict);
}

export async function searchAvailability(input: {
  size?: TrailerSize;
  dateRangeType: DateRangeType;
  start: string;
  end: string;
  flexWindowDays: number;
  excludeReservationId?: string;
}): Promise<AvailabilityCandidate[]> {
  const sizes = input.size ? [input.size] : TRAILER_SIZE;
  // A flexible window that starts before today is not a real option.
  const today = quebecDay();
  const windows = buildWindows(input.dateRangeType, input.start, input.end, input.flexWindowDays).filter((w) => w.start >= today);
  const candidates: AvailabilityCandidate[] = [];

  for (const size of sizes) {
    const meta = catalogueFor(size);
    if (!meta) continue;

    const trailers = await prisma.trailer.findMany({
      where: { size, status: "available" },
    });

    for (const trailer of trailers) {
      for (const w of windows) {
        const conflicting = await hasConflict(trailer.id, w.start, w.end, input.excludeReservationId);
        if (conflicting) continue;

        candidates.push({
          trailerId: trailer.id,
          size,
          tempRangeLabel: meta.tempRangeLabel,
          windowStart: w.start,
          windowEnd: w.end,
          nights: nights(w.start, w.end),
          totalCents: computeTotalCents(size, w.start, w.end),
        });
      }
    }
  }

  return candidates;
}

// Runs `work` with the trailer's row locked, so decisions about one trailer go through one at a time:
// a check for a conflict and the write that follows it cannot be interleaved with another client's.
export function withTrailerLock<T>(trailerId: string, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM trailers WHERE id = ${trailerId} FOR UPDATE`;
      return work(tx);
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

export { hasConflict };
