import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { getSignatureProvider } from "@/lib/providers/signature";

export async function POST(_request: Request, { params }: { params: Promise<{ reservationId: string }> }) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { reservationId } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { contract: true } });
  if (!reservation || reservation.clientId !== clientId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  if (reservation.status !== "pending") {
    return NextResponse.json({ error: "Cette réservation n'est plus modifiable" }, { status: 409 });
  }
  if (!reservation.trailerId || !reservation.pickupDate || !reservation.returnDate) {
    return NextResponse.json({ error: "Sélectionnez d'abord une remorque et des dates" }, { status: 409 });
  }

  // A signed contract is what the client agreed to: it is not regenerated. (When the terms change the
  // signature is cleared first, see PATCH /api/reservations/[id], and a new contract is generated.)
  if (reservation.contract?.signatureStatus === "signed" && reservation.contract.pdfUrl) {
    return NextResponse.json({ pdfUrl: reservation.contract.pdfUrl });
  }

  const { pdfUrl } = await getSignatureProvider().generateContract({ reservationId });
  return NextResponse.json({ pdfUrl });
}
