import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminId } from "@/lib/session";
import { hasConflict } from "@/lib/availability";
import { adminReservationCreateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const adminId = await getCurrentAdminId();
  if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = adminReservationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const { clientId, trailerId, pickupDate, returnDate, totalAmount, status, note, pickupTime, returnTime } =
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
    },
    include: { client: true, trailer: true },
  });

  return NextResponse.json(reservation);
}
