import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getSignatureProvider } from "@/lib/providers/signature";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { contract: true } });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!reservation.trailerId || !reservation.pickupDate || !reservation.returnDate) {
    return NextResponse.json({ error: "Remorque et dates requises avant de générer le contrat" }, { status: 409 });
  }

  // A signed contract is what the client agreed to: it is not regenerated.
  if (reservation.contract?.signatureStatus === "signed" && reservation.contract.pdfUrl) {
    return NextResponse.json({ pdfUrl: reservation.contract.pdfUrl });
  }

  const { pdfUrl } = await getSignatureProvider().generateContract({ reservationId: id });
  return NextResponse.json({ pdfUrl });
}
