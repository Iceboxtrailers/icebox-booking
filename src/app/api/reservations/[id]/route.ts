import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { DATE_RANGE_TYPE, DELIVERY_OPTION, deliveryTrips } from "@/lib/constants";
import type { DeliveryOption, TrailerSize } from "@/lib/constants";
import { MAX_ONLINE_RENTAL_NIGHTS, computeDeliveryFeeCents, computeTotalCents } from "@/lib/pricing";
import { getDrivingDistanceKm } from "@/lib/geo/distance";
import { hasConflict } from "@/lib/availability";
import { nights, quebecDay } from "@/lib/dates";
import { RATE_RULES, rejectIfOverLimit } from "@/lib/rate-limit";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

// The price is never taken from the client: it is worked out here from the trailer, the dates
// and the delivery. Unknown fields (an old page still sending totalAmount) are ignored.
const patchSchema = z.object({
  dateRangeType: z.enum(DATE_RANGE_TYPE).optional(),
  pickupDate: isoDate.optional(),
  returnDate: isoDate.optional(),
  flexWindowDays: z.number().int().min(0).max(14).optional(),
  trailerId: z.string().min(1).optional(),
  usageLocation: z.string().trim().min(1, "Lieu d'utilisation requis").max(200).optional(),
  deliveryOption: z.enum(DELIVERY_OPTION).optional(),
});

const isoDay = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

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

  // Dates: what the request says, else what is already saved.
  const storedPickup = isoDay(reservation.pickupDate);
  const storedReturn = isoDay(reservation.returnDate);
  const nextPickup = pickupDate ?? storedPickup;
  const nextReturn = returnDate ?? storedReturn;
  if (pickupDate && pickupDate < quebecDay()) {
    return NextResponse.json({ error: "La date de ramassage ne peut pas être dans le passé" }, { status: 400 });
  }
  if (nextPickup && nextReturn) {
    if (nextReturn <= nextPickup) {
      return NextResponse.json({ error: "La date de retour doit être après la date de ramassage" }, { status: 400 });
    }
    if (nights(nextPickup, nextReturn) > MAX_ONLINE_RENTAL_NIGHTS) {
      return NextResponse.json(
        { error: "Pour une location de plus d'un an, communiquez directement avec IceBox au 581 889-2093." },
        { status: 400 },
      );
    }
  }
  if (rest.trailerId && (!nextPickup || !nextReturn)) {
    return NextResponse.json({ error: "Choisissez d'abord vos dates" }, { status: 400 });
  }

  // Transport.
  const deliveryOption = rest.deliveryOption ?? reservation.deliveryOption;
  const usageLocation = rest.usageLocation ?? reservation.usageLocation;
  let deliveryFeeCents = reservation.deliveryFeeCents;
  let deliveryDistanceKm = reservation.deliveryDistanceKm;

  if (rest.deliveryOption !== undefined || rest.usageLocation !== undefined) {
    const trips = deliveryTrips(deliveryOption as DeliveryOption);
    if (trips > 0 && usageLocation) {
      // Each lookup is a paid Google Maps call.
      const limited = await rejectIfOverLimit(RATE_RULES.maps, clientId);
      if (limited) return limited;
      try {
        deliveryDistanceKm = await getDrivingDistanceKm(usageLocation);
        deliveryFeeCents = computeDeliveryFeeCents(deliveryDistanceKm, trips);
      } catch (error) {
        console.error("Delivery distance lookup failed", error);
        return NextResponse.json(
          {
            error:
              "Impossible de calculer la distance pour cette adresse. Vérifiez l'adresse (numéro, rue, ville) ou choisissez le ramassage au dépôt.",
          },
          { status: 422 },
        );
      }
    } else {
      deliveryDistanceKm = null;
      deliveryFeeCents = 0;
    }
  }

  // Trailer and price. A trailer picked for other dates is no longer a valid choice, so the client
  // picks again; the same goes for a saved trailer that has since been taken or taken out of service.
  const datesChanged = nextPickup !== storedPickup || nextReturn !== storedReturn;
  let trailerId: string | null = rest.trailerId ?? reservation.trailerId;
  let totalAmount = 0;
  if (rest.trailerId === undefined && datesChanged) trailerId = null;

  if (trailerId && nextPickup && nextReturn) {
    const trailer = await prisma.trailer.findUnique({ where: { id: trailerId } });
    const usable = trailer?.status === "available" && !(await hasConflict(trailerId, nextPickup, nextReturn, reservation.id));
    if (trailer && usable) {
      totalAmount = computeTotalCents(trailer.size as TrailerSize, nextPickup, nextReturn) + deliveryFeeCents;
    } else if (rest.trailerId !== undefined) {
      return NextResponse.json(
        { error: "Cette remorque n'est plus disponible pour ces dates, veuillez recommencer la sélection" },
        { status: 409 },
      );
    } else {
      trailerId = null;
    }
  } else {
    trailerId = null;
  }

  // Whatever the client agreed to is the contract as it stood: if the terms change, the saved PDF and
  // the signature no longer match them, so both are cleared and the client signs again.
  const termsChanged =
    trailerId !== reservation.trailerId ||
    datesChanged ||
    totalAmount !== reservation.totalAmount ||
    deliveryOption !== reservation.deliveryOption ||
    usageLocation !== reservation.usageLocation;

  // Cleared first: if the second write failed, the worst case is signing again, never a stale signature.
  if (termsChanged) {
    await prisma.contract.updateMany({
      where: { reservationId: id },
      data: { pdfUrl: null, signatureStatus: "pending", signedAt: null, signerIp: null, signerName: null, signatureImageUrl: null },
    });
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      ...rest,
      trailerId,
      totalAmount,
      deliveryDistanceKm,
      deliveryFeeCents,
      ...(pickupDate ? { pickupDate: new Date(`${pickupDate}T00:00:00Z`) } : {}),
      ...(returnDate ? { returnDate: new Date(`${returnDate}T00:00:00Z`) } : {}),
    },
  });

  return NextResponse.json(updated);
}
