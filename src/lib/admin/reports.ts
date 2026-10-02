import { prisma } from "@/lib/prisma";
import { REAL_BOOKING_STATUSES } from "@/lib/admin/kpis";

export type ReportReservation = {
  id: string;
  clientName: string;
  trailerLabel: string;
  pickupDate: Date;
  returnDate: Date;
  status: string;
  totalAmount: number;
};

const STATUS_LABEL_FR: Record<string, string> = {
  confirmed: "Confirmée",
  in_progress: "En cours",
  completed: "Terminée",
};

// Rentals that actually happened (or are booked to), excluding pending/cancelled
// and admin-flagged test bookings — same convention as the dashboard KPIs.
// Scoped by pickup date, so a rental is reported in the month/year it started.
export async function getReservationsForReport(startIso: string, endIso: string): Promise<ReportReservation[]> {
  const start = new Date(`${startIso}T00:00:00Z`);
  const endExclusive = new Date(`${endIso}T00:00:00Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: REAL_BOOKING_STATUSES },
      isTest: false,
      pickupDate: { gte: start, lt: endExclusive },
    },
    include: { client: true, trailer: true },
    orderBy: { pickupDate: "asc" },
  });

  return reservations
    .filter((r) => r.pickupDate && r.returnDate)
    .map((r) => ({
      id: r.id,
      clientName: `${r.client.firstName} ${r.client.lastName}`,
      trailerLabel: r.trailer ? `${r.trailer.name} (${r.trailer.size})` : "—",
      pickupDate: r.pickupDate!,
      returnDate: r.returnDate!,
      status: STATUS_LABEL_FR[r.status] ?? r.status,
      totalAmount: r.totalAmount,
    }));
}
