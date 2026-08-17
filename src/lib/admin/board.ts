import { prisma } from "@/lib/prisma";
import type { TrailerSize } from "@/lib/constants";

export type BoardTrailer = {
  id: string;
  name: string;
  size: TrailerSize;
  status: string;
  imageUrl: string | null;
  description: string | null;
};

export type BoardReservation = {
  id: string;
  trailerId: string;
  clientName: string;
  clientPhone: string;
  pickupDate: string; // ISO date
  returnDate: string; // ISO date
  pickupTime: string | null;
  returnTime: string | null;
  note: string | null;
  status: string;
  totalAmount: number;
};

export type FleetBoardData = {
  year: number;
  month: number; // 1-12
  trailers: BoardTrailer[];
  monthReservations: BoardReservation[];
  fleetSize: number;
  availableToday: number;
  toConfirmCount: number;
  conflictReservationIds: string[];
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getFleetBoardData(year: number, month: number): Promise<FleetBoardData> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEndExclusive = new Date(Date.UTC(year, month, 1));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [trailers, monthRes, activeReservations, toConfirmCount] = await Promise.all([
    prisma.trailer.findMany({ orderBy: [{ size: "asc" }, { name: "asc" }] }),
    prisma.reservation.findMany({
      where: {
        status: { not: "cancelled" },
        trailerId: { not: null },
        pickupDate: { lt: monthEndExclusive },
        returnDate: { gt: monthStart },
      },
      include: { client: true },
      orderBy: { pickupDate: "asc" },
    }),
    prisma.reservation.findMany({
      where: { status: { not: "cancelled" }, trailerId: { not: null } },
      select: { id: true, trailerId: true, pickupDate: true, returnDate: true },
    }),
    // Pending reservations whose pickup date has already passed no longer
    // need confirming (the window's gone) — they stay visible in the grid
    // to track demand, they just drop out of this count.
    prisma.reservation.count({ where: { status: "pending", pickupDate: { gte: today } } }),
  ]);

  const monthReservations: BoardReservation[] = monthRes
    .filter((r) => r.trailerId && r.pickupDate && r.returnDate)
    .map((r) => ({
      id: r.id,
      trailerId: r.trailerId!,
      clientName: `${r.client.firstName} ${r.client.lastName}`,
      clientPhone: r.client.phone,
      pickupDate: toIsoDate(r.pickupDate!),
      returnDate: toIsoDate(r.returnDate!),
      pickupTime: r.pickupTime,
      returnTime: r.returnTime,
      note: r.note,
      status: r.status,
      totalAmount: r.totalAmount,
    }));

  const occupiedTrailerIds = new Set(
    activeReservations
      .filter((r) => r.pickupDate && r.returnDate && r.pickupDate <= today && r.returnDate > today)
      .map((r) => r.trailerId)
  );
  const availableToday = trailers.filter(
    (t) => t.status === "available" && !occupiedTrailerIds.has(t.id)
  ).length;

  // Global pairwise-overlap conflict detection per trailer, so switching
  // months doesn't make conflict flags flicker on/off.
  const byTrailer = new Map<string, typeof activeReservations>();
  for (const r of activeReservations) {
    if (!r.trailerId || !r.pickupDate || !r.returnDate) continue;
    const list = byTrailer.get(r.trailerId) ?? [];
    list.push(r);
    byTrailer.set(r.trailerId, list);
  }
  const conflictReservationIds: string[] = [];
  for (const list of byTrailer.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.pickupDate! < b.returnDate! && b.pickupDate! < a.returnDate!) {
          conflictReservationIds.push(a.id, b.id);
        }
      }
    }
  }

  return {
    year,
    month,
    trailers: trailers.map((t) => ({
      id: t.id,
      name: t.name,
      size: t.size as TrailerSize,
      status: t.status,
      imageUrl: t.imageUrl,
      description: t.description,
    })),
    monthReservations,
    fleetSize: trailers.length,
    availableToday,
    toConfirmCount,
    conflictReservationIds: Array.from(new Set(conflictReservationIds)),
  };
}
