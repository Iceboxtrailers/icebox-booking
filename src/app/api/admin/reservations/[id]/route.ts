import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { hasConflict } from "@/lib/availability";
import { adminReservationUpdateSchema } from "@/lib/validation";

const RESERVATION_CLIENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      client: { select: RESERVATION_CLIENT_SELECT },
      trailer: true,
      contract: { select: { pdfUrl: true, signatureStatus: true } },
      returnInspection: true,
    },
  });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  return NextResponse.json(reservation);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const { admin } = guard;

  const { id } = await params;
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = adminReservationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const {
    pickupDate,
    returnDate,
    trailerId,
    note,
    pickupTime,
    returnTime,
    acknowledgeDepositExpiry,
    waiveDeposit,
    ...rest
  } = parsed.data;

  // Staff accounts can mark a trailer as departed and edit notes/times; prices,
  // dates, trailer, cancellations and flags stay with the owner.
  if (admin.role === "employee") {
    const forbidden =
      pickupDate !== undefined ||
      returnDate !== undefined ||
      trailerId !== undefined ||
      rest.totalAmount !== undefined ||
      rest.isTest !== undefined ||
      (rest.status !== undefined && rest.status !== "in_progress" && rest.status !== existing.status);
    if (forbidden) {
      return NextResponse.json({ error: "Modification réservée au propriétaire" }, { status: 403 });
    }
  }

  // No trailer leaves without an active deposit hold.
  if (rest.status === "in_progress" && existing.status !== "in_progress") {
    if (waiveDeposit) {
      if (admin.role !== "owner") {
        return NextResponse.json({ error: "Seul le propriétaire peut dispenser le dépôt" }, { status: 403 });
      }
      await logAudit({
        action: "departure_deposit_waived",
        reservationId: id,
        actor: { type: "admin", id: admin.id },
        details: { depositStatus: existing.depositStatus },
      });
    } else if (existing.depositStatus !== "authorized") {
      return NextResponse.json(
        {
          error: "Aucun dépôt retenu : placez la retenue avant la remise de la remorque",
          code: "deposit_required",
        },
        { status: 409 },
      );
    } else if (existing.depositExpiresAt && existing.depositExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "La retenue a expiré : renouvelez-la avant la remise", code: "deposit_required" },
        { status: 409 },
      );
    } else if (
      existing.depositExpiresAt &&
      existing.returnDate &&
      existing.depositExpiresAt < existing.returnDate &&
      !acknowledgeDepositExpiry
    ) {
      return NextResponse.json(
        {
          error: "La retenue expire avant la date de retour : un renouvellement sera nécessaire pendant la location",
          code: "deposit_expires_before_return",
        },
        { status: 409 },
      );
    }
  }

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
    include: {
      client: { select: RESERVATION_CLIENT_SELECT },
      trailer: true,
      contract: { select: { pdfUrl: true, signatureStatus: true } },
    },
  });

  return NextResponse.json(updated);
}
