import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { getSignatureProvider } from "@/lib/providers/signature";
import { logAudit } from "@/lib/audit";
import { isPng } from "@/lib/file-type";
import { RATE_RULES, rejectIfOverLimit } from "@/lib/rate-limit";
import { MAX_SIGNATURE_BYTES } from "@/lib/signature";
import { signContractSchema } from "@/lib/validation";

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
  const limited = await rejectIfOverLimit(RATE_RULES.contract, clientId);
  if (limited) return limited;
  // Once the booking is confirmed the signed contract is final.
  if (reservation.status !== "pending") {
    return NextResponse.json({ error: "Cette réservation n'est plus modifiable" }, { status: 409 });
  }
  if (!reservation.trailerId || !reservation.pickupDate || !reservation.returnDate) {
    return NextResponse.json({ error: "Sélectionnez d'abord une remorque et des dates" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = signContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const base64Data = parsed.data.signatureImageBase64.replace(/^data:image\/png;base64,/, "");
  const signatureImageBuffer = Buffer.from(base64Data, "base64");
  if (!isPng(signatureImageBuffer) || signatureImageBuffer.length > MAX_SIGNATURE_BYTES) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  // The signed copy of the contract is made here, from the terms as they stand now (the unsigned one the
  // client read is replaced), so the signature always goes with a contract that matches the booking.
  const result = await getSignatureProvider().captureSignature({
    reservationId,
    signatureImageBuffer,
    signerName: parsed.data.signerName,
    signerIp: requesterIp(request),
    method: parsed.data.signatureMethod,
  });
  await logAudit({
    action: "contract_signed",
    reservationId,
    actor: { type: "client", id: clientId },
    details: { method: parsed.data.signatureMethod },
  });

  return NextResponse.json(result);
}
