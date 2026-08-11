import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { DATE_RANGE_TYPE } from "@/lib/constants";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

const patchSchema = z.object({
  dateRangeType: z.enum(DATE_RANGE_TYPE).optional(),
  pickupDate: isoDate.optional(),
  returnDate: isoDate.optional(),
  flexWindowDays: z.number().int().min(0).max(14).optional(),
  trailerId: z.string().min(1).optional(),
  totalAmount: z.number().int().min(0).optional(),
  usageLocation: z.string().trim().min(1, "Lieu d'utilisation requis").optional(),
});

async function loadOwnedReservation(id: string, clientId: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation || reservation.clientId !== clientId) return null;
  return reservation;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { trailer: true, contract: true, payments: true, client: true },
  });
  if (!reservation || reservation.clientId !== clientId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  return NextResponse.json(reservation);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const reservation = await loadOwnedReservation(id, clientId);
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (reservation.status !== "pending") {
    return NextResponse.json({ error: "Cette réservation n'est plus modifiable" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const { pickupDate, returnDate, ...rest } = parsed.data;
  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      ...rest,
      ...(pickupDate ? { pickupDate: new Date(`${pickupDate}T00:00:00Z`) } : {}),
      ...(returnDate ? { returnDate: new Date(`${returnDate}T00:00:00Z`) } : {}),
    },
  });

  return NextResponse.json(updated);
}
