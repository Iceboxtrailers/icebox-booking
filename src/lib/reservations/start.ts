import { prisma } from "@/lib/prisma";

// An unfinished booking with no trailer yet is picked up again rather than a new one started, so a
// reload or a trip back to the start never piles up empty bookings.
const REUSE_WINDOW_MS = 2 * 60 * 60 * 1000;
// Starting a booking costs the client nothing, so the number started in a day is capped.
const MAX_STARTED_PER_DAY = 10;

// Returns the booking to continue, or null when the client has started too many today.
export async function startOrResumeReservation(
  clientId: string,
  dates: { pickupDate?: Date; returnDate?: Date } = {},
): Promise<{ id: string } | null> {
  const now = Date.now();

  const unfinished = await prisma.reservation.findFirst({
    where: { clientId, status: "pending", trailerId: null, createdAt: { gt: new Date(now - REUSE_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (unfinished) {
    if (dates.pickupDate && dates.returnDate) await prisma.reservation.update({ where: { id: unfinished.id }, data: dates });
    return unfinished;
  }

  const startedToday = await prisma.reservation.count({
    where: { clientId, createdAt: { gt: new Date(now - 24 * 60 * 60 * 1000) } },
  });
  if (startedToday >= MAX_STARTED_PER_DAY) return null;

  return prisma.reservation.create({ data: { clientId, ...dates }, select: { id: true } });
}
