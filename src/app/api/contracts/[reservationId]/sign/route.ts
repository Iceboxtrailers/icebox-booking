import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { getSignatureProvider } from "@/lib/providers/signature";

const signSchema = z.object({
  signerName: z.string().trim().min(1, "Nom du signataire requis"),
  signatureImageBase64: z.string().min(1, "Signature requise"),
});

function requesterIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "127.0.0.1";
}

export async function POST(request: Request, { params }: { params: Promise<{ reservationId: string }> }) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { reservationId } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation || reservation.clientId !== clientId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = signSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const base64Data = parsed.data.signatureImageBase64.replace(/^data:image\/png;base64,/, "");
  const signatureImageBuffer = Buffer.from(base64Data, "base64");

  const result = await getSignatureProvider().captureSignature({
    reservationId,
    signatureImageBuffer,
    signerName: parsed.data.signerName,
    signerIp: requesterIp(request),
  });

  return NextResponse.json(result);
}
