import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { getSignatureProvider } from "@/lib/providers/signature";
import { isPng } from "@/lib/file-type";

const MAX_SIGNATURE_BYTES = 300 * 1024;

const signSchema = z.object({
  signerName: z.string().trim().min(1, "Nom du signataire requis").max(120, "Nom trop long"),
  // base64 is about a third larger than the image it carries
  signatureImageBase64: z.string().min(1, "Signature requise").max(Math.ceil(MAX_SIGNATURE_BYTES * 1.4)),
});

function requesterIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "127.0.0.1";
}

export async function POST(request: Request, { params }: { params: Promise<{ reservationId: string }> }) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { reservationId } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { contract: true } });
  if (!reservation || reservation.clientId !== clientId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  // Once the booking is confirmed the signed contract is final.
  if (reservation.status !== "pending") {
    return NextResponse.json({ error: "Cette réservation n'est plus modifiable" }, { status: 409 });
  }
  if (!reservation.trailerId || !reservation.pickupDate || !reservation.returnDate) {
    return NextResponse.json({ error: "Sélectionnez d'abord une remorque et des dates" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = signSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const base64Data = parsed.data.signatureImageBase64.replace(/^data:image\/png;base64,/, "");
  const signatureImageBuffer = Buffer.from(base64Data, "base64");
  if (!isPng(signatureImageBuffer) || signatureImageBuffer.length > MAX_SIGNATURE_BYTES) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  const provider = getSignatureProvider();
  // The signature always goes with a contract generated for the terms as they stand now.
  if (!reservation.contract?.pdfUrl) await provider.generateContract({ reservationId });

  const result = await provider.captureSignature({
    reservationId,
    signatureImageBuffer,
    signerName: parsed.data.signerName,
    signerIp: requesterIp(request),
  });

  return NextResponse.json(result);
}
