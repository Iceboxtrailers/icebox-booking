import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { hasConflict, withTrailerLock } from "@/lib/availability";
import { holdsSlot } from "@/lib/constants";
import { syncReservationToQuickBooks } from "@/lib/accounting/sync";
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

  // Only a booking that holds its trailer can clash with another one: unfinished (pending) and cancelled
  // bookings block nobody. So the check runs when the result holds the trailer and either it starts holding
  // it now (confirming a pending booking, reopening a cancelled one) or its trailer or dates change.
  const nextStatus = rest.status ?? existing.status;
  const startsHolding = holdsSlot(nextStatus) && !holdsSlot(existing.status);
  const mustCheck = Boolean(
    nextTrailerId && nextPickup && nextReturn && holdsSlot(nextStatus) && (startsHolding || trailerId || pickupDate || returnDate),
  );

  const applyUpdate = (db: Pick<typeof prisma, "reservation">) =>
    db.reservation.update({
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

  let updated;
  if (mustCheck) {
    // Checked and written with the trailer locked, so a client finishing a booking at the same moment
    // cannot take the same dates.
    const start = nextPickup!.toISOString().slice(0, 10);
    const end = nextReturn!.toISOString().slice(0, 10);
    updated = await withTrailerLock(nextTrailerId!, async (tx) => {
      if (await hasConflict(nextTrailerId!, start, end, id, tx)) return null;
      return applyUpdate(tx);
    });
    if (!updated) {
      return NextResponse.json({ error: "Cette remorque est déjà réservée pour ces dates" }, { status: 409 });
    }
  } else {
    updated = await applyUpdate(prisma);
  }

  if (rest.status === "confirmed" && existing.status !== "confirmed") {
    await syncReservationToQuickBooks(id, { actorAdminId: admin.id });
  }

  return NextResponse.json(updated);
}
