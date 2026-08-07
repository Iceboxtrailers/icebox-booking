import { prisma } from "@/lib/prisma";
import type { TrailerSize } from "@/lib/constants";

const REAL_BOOKING_STATUSES = ["confirmed", "in_progress", "completed"];

export type DashboardKpis = {
  totalReservations: number;
  reservationsThisMonth: number;
  totalRevenueCents: number;
  avgNights: number | null;
  bookingsBySize: { size: TrailerSize; count: number }[];
  upcomingCount: number;
};

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const reservations = await prisma.reservation.findMany({
    where: { status: { in: REAL_BOOKING_STATUSES } },
    include: { trailer: true },
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  let totalRevenueCents = 0;
  let nightsSum = 0;
  let nightsCount = 0;
  let reservationsThisMonth = 0;
  let upcomingCount = 0;
  const bySize = new Map<string, number>();

  for (const r of reservations) {
    totalRevenueCents += r.totalAmount;

    if (r.pickupDate && r.returnDate) {
      const nights = Math.round((r.returnDate.getTime() - r.pickupDate.getTime()) / 86400000);
      nightsSum += nights;
      nightsCount += 1;
    }

    if (r.pickupDate && r.pickupDate >= startOfMonth) {
      reservationsThisMonth += 1;
    }

    if (r.pickupDate && r.pickupDate >= startOfToday) {
      upcomingCount += 1;
    }

    if (r.trailer) {
      bySize.set(r.trailer.size, (bySize.get(r.trailer.size) ?? 0) + 1);
    }
  }

  return {
    totalReservations: reservations.length,
    reservationsThisMonth,
    totalRevenueCents,
    avgNights: nightsCount > 0 ? nightsSum / nightsCount : null,
    bookingsBySize: Array.from(bySize.entries())
      .map(([size, count]) => ({ size: size as TrailerSize, count }))
      .sort((a, b) => b.count - a.count),
    upcomingCount,
  };
}
