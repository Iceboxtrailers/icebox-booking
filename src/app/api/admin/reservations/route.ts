import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { hasConflict } from "@/lib/availability";
import { adminReservationCreateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const ownerGuard = await requireOwner();
  if (ownerGuard.error) return ownerGuard.error;

  const body = await request.json().catch(() => null);
  const parsed = adminReservationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const { clientId, trailerId, pickupDate, returnDate, totalAmount, status, note, pickupTime, returnTime, isTest } =
    parsed.data;

  const conflicting = await hasConflict(trailerId, pickupDate, returnDate);
  if (conflicting) {
    return NextResponse.json({ error: "Cette remorque est déjà réservée pour ces dates" }, { status: 409 });
  }

  const reservation = await prisma.reservation.create({
    data: {
      clientId,
      trailerId,
      pickupDate: new Date(`${pickupDate}T00:00:00Z`),
      returnDate: new Date(`${returnDate}T00:00:00Z`),
      totalAmount,
      status: status ?? "confirmed",
      dateRangeType: "fixed",
      note: note || null,
      pickupTime: pickupTime || null,
      returnTime: returnTime || null,
      isTest: isTest ?? false,
    },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      trailer: true,
    },
  });

  return NextResponse.json(reservation);
}
