import { prisma } from "@/lib/prisma";

// Steps of an online booking, in the order of the wizard. Each one leaves a trace on the
// reservation, so the report needs no tracking code: it only reads what is already stored.
export const FUNNEL_STEPS = [
  "Coordonnées saisies",
  "Dates choisies",
  "Remorque choisie",
  "Contrat signé",
  "Carte enregistrée",
  "Réservation confirmée",
] as const;

const COMPLETED_STATUSES = ["confirmed", "in_progress", "completed"];

// A booking still "pending" after this long is counted as abandoned; younger ones are still in progress.
export const ABANDONED_AFTER_MS = 2 * 60 * 60 * 1000;

export type FunnelRow = {
  id: string;
  createdAt: Date;
  status: string;
  pickupDate: Date | null;
  returnDate: Date | null;
  trailerId: string | null;
  totalAmount: number;
  stripePaymentMethodId: string | null;
  contract: { signatureStatus: string } | null;
  trailer: { size: string } | null;
  client: { firstName: string; lastName: string; email: string; phone: string };
};

export type AbandonedBooking = {
  id: string;
  createdAt: Date;
  name: string;
  email: string;
  phone: string;
  stepLabel: string;
  pickupDate: string | null;
  returnDate: string | null;
  trailerSize: string | null;
  totalCents: number;
};

export type FunnelReport = {
  days: number;
  started: number;
  inProgress: number;
  confirmed: number;
  /** confirmed / (started - inProgress), or null while nothing can be judged yet */
  conversionRate: number | null;
  steps: { label: string; count: number }[];
  abandoned: AbandonedBooking[];
};

// Index (0-5) of the furthest booking step this reservation reached.
export function furthestStep(r: Pick<FunnelRow, "status" | "pickupDate" | "returnDate" | "trailerId" | "stripePaymentMethodId" | "contract">): number {
  const signed = r.contract?.signatureStatus === "signed";
  const completed =
    COMPLETED_STATUSES.includes(r.status) || (r.status === "cancelled" && signed && Boolean(r.stripePaymentMethodId));
  if (completed) return 5;
  if (r.stripePaymentMethodId) return 4;
  if (signed) return 3;
  if (r.trailerId) return 2;
  if (r.pickupDate && r.returnDate) return 1;
  return 0;
}

const isoDate = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

export function analyzeFunnel(rows: FunnelRow[], days: number, now = Date.now()): FunnelReport {
  const reached = rows.map((row) => furthestStep(row));
  const steps = FUNNEL_STEPS.map((label, index) => ({ label, count: reached.filter((step) => step >= index).length }));

  const isPending = (row: FunnelRow) => row.status === "pending";
  const isAbandoned = (row: FunnelRow) => isPending(row) && now - row.createdAt.getTime() > ABANDONED_AFTER_MS;
  const inProgress = rows.filter((row) => isPending(row) && !isAbandoned(row)).length;

  const started = rows.length;
  const confirmed = steps[FUNNEL_STEPS.length - 1].count;
  const judged = started - inProgress;

  const abandoned = rows
    .map((row, index) => ({ row, step: reached[index] }))
    .filter(({ row }) => isAbandoned(row))
    .map(({ row, step }) => ({
      id: row.id,
      createdAt: row.createdAt,
      name: `${row.client.firstName} ${row.client.lastName}`.trim(),
      email: row.client.email,
      phone: row.client.phone,
      stepLabel: FUNNEL_STEPS[step],
      pickupDate: isoDate(row.pickupDate),
      returnDate: isoDate(row.returnDate),
      trailerSize: row.trailer?.size ?? null,
      totalCents: row.totalAmount,
    }));

  return { days, started, inProgress, confirmed, conversionRate: judged > 0 ? confirmed / judged : null, steps, abandoned };
}

export async function getBookingFunnel(days: number): Promise<FunnelReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.reservation.findMany({
    where: {
      createdAt: { gte: since },
      isTest: false,
      // Reservations typed in by the owner are created already confirmed, with no contract and
      // no saved card. Online bookings start "pending" or carry a contract or a card.
      OR: [{ status: "pending" }, { contract: { isNot: null } }, { stripePaymentMethodId: { not: null } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      status: true,
      pickupDate: true,
      returnDate: true,
      trailerId: true,
      totalAmount: true,
      stripePaymentMethodId: true,
      contract: { select: { signatureStatus: true } },
      trailer: { select: { size: true } },
      client: { select: { firstName: true, lastName: true, email: true, phone: true } },
    },
  });
  return analyzeFunnel(rows, days);
}
