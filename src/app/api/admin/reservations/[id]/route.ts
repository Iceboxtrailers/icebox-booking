import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminId } from "@/lib/session";
import { hasConflict } from "@/lib/availability";
import { adminReservationUpdateSchema } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getCurrentAdminId();
  if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { client: true, trailer: true },
  });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  return NextResponse.json(reservation);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getCurrentAdminId();
  if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = adminReservationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const { pickupDate, returnDate, trailerId, note, pickupTime, returnTime, ...rest } = parsed.data;
  const nextTrailerId = trailerId ?? existing.trailerId;
  const nextPickup = pickupDate ? new Date(`${pickupDate}T00:00:00Z`) : existing.pickupDate;
  const nextReturn = returnDate ? new Date(`${returnDate}T00:00:00Z`) : existing.returnDate;

  if (nextTrailerId && nextPickup && nextReturn && (trailerId || pickupDate || returnDate)) {
    const start = nextPickup.toISOString().slice(0, 10);
    const end = nextReturn.toISOString().slice(0, 10);
    const conflicting = await hasConflict(nextTrailerId, start, end, id);
    if (conflicting) {
      return NextResponse.json(
        { error: "Cette remorque est déjà réservée pour ces dates" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      ...rest,
      ...(trailerId ? { trailerId } : {}),
      ...(pickupDate ? { pickupDate: nextPickup } : {}),
      ...(returnDate ? { returnDate: nextReturn } : {}),
      ...(note !== undefined ? { note: note || null } : {}),
      ...(pickupTime !== undefined ? { pickupTime: pickupTime || null } : {}),
      ...(returnTime !== undefined ? { returnTime: returnTime || null } : {}),
    },
    include: { client: true, trailer: true },
  });

  return NextResponse.json(updated);
}
