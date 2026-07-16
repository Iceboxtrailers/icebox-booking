import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { getSignatureProvider } from "@/lib/providers/signature";

export async function POST(_request: Request, { params }: { params: Promise<{ reservationId: string }> }) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { reservationId } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation || reservation.clientId !== clientId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  if (!reservation.trailerId || !reservation.pickupDate || !reservation.returnDate) {
    return NextResponse.json({ error: "Sélectionnez d'abord une remorque et des dates" }, { status: 409 });
  }

  const { pdfUrl } = await getSignatureProvider().generateContract({ reservationId });
  return NextResponse.json({ pdfUrl });
}
