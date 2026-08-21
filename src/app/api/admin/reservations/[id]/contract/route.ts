import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminId } from "@/lib/session";
import { getSignatureProvider } from "@/lib/providers/signature";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getCurrentAdminId();
  if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!reservation.trailerId || !reservation.pickupDate || !reservation.returnDate) {
    return NextResponse.json({ error: "Remorque et dates requises avant de générer le contrat" }, { status: 409 });
  }

  const { pdfUrl } = await getSignatureProvider().generateContract({ reservationId: id });
  return NextResponse.json({ pdfUrl });
}
