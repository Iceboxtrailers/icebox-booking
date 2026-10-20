import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin-auth";
import { hasConflict, withTrailerLock } from "@/lib/availability";
import { adminReservationCreateSchema } from "@/lib/validation";
import { syncReservationToQuickBooks } from "@/lib/accounting/sync";

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

  // Checked and written with the trailer locked: a client finishing a booking at the same moment cannot
  // take the same dates.
  const reservation = await withTrailerLock(trailerId, async (tx) => {
    if (await hasConflict(trailerId, pickupDate, returnDate, undefined, tx)) return null;
    return tx.reservation.create({
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
  });
  if (!reservation) {
    return NextResponse.json({ error: "Cette remorque est déjà réservée pour ces dates" }, { status: 409 });
  }

  await syncReservationToQuickBooks(reservation.id, { actorAdminId: ownerGuard.admin.id });

  return NextResponse.json(reservation);
}
