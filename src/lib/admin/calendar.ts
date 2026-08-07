import { prisma } from "@/lib/prisma";

export type CalendarBlock = {
  reservationId: string;
  startDay: number; // 1-based day-of-month, clipped to the visible month
  endDay: number; // inclusive
  label: string; // client last name
};

export type CalendarRow = {
  trailerId: string;
  trailerName: string;
  size: string;
  blocks: CalendarBlock[];
};

export type MonthCalendar = {
  year: number;
  month: number; // 1-12
  daysInMonth: number;
  rows: CalendarRow[];
};

export async function getFleetCalendar(year: number, month: number): Promise<MonthCalendar> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEndExclusive = new Date(Date.UTC(year, month, 1)); // first day of next month
  const daysInMonth = Math.round((monthEndExclusive.getTime() - monthStart.getTime()) / 86400000);
  const lastVisibleDay = new Date(monthEndExclusive.getTime() - 86400000);

  const trailers = await prisma.trailer.findMany({ orderBy: [{ size: "asc" }, { name: "asc" }] });

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { not: "cancelled" },
      trailerId: { not: null },
      pickupDate: { lt: monthEndExclusive },
      returnDate: { gt: monthStart },
    },
    include: { client: true },
  });

  const rows: CalendarRow[] = trailers.map((trailer) => {
    const blocks: CalendarBlock[] = reservations
      .filter((r) => r.trailerId === trailer.id && r.pickupDate && r.returnDate)
      .map((r) => {
        const clippedStart = r.pickupDate! < monthStart ? monthStart : r.pickupDate!;
        // returnDate is exclusive (checkout morning), so the last occupied day is returnDate - 1
        const lastOccupied = new Date(r.returnDate!.getTime() - 86400000);
        const clippedEnd = lastOccupied > lastVisibleDay ? lastVisibleDay : lastOccupied;

        return {
          reservationId: r.id,
          startDay: clippedStart.getUTCDate(),
          endDay: clippedEnd.getUTCDate(),
          label: r.client.lastName,
        };
      })
      .sort((a, b) => a.startDay - b.startDay);

    return { trailerId: trailer.id, trailerName: trailer.name, size: trailer.size, blocks };
  });

  return { year, month, daysInMonth, rows };
}
