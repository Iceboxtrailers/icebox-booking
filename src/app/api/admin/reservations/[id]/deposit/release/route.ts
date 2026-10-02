import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminId } from "@/lib/session";
import { getPaymentProvider } from "@/lib/providers/payment";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getCurrentAdminId();
  if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (reservation.depositStatus !== "authorized") {
    return NextResponse.json({ error: "Aucun dépôt autorisé à libérer" }, { status: 409 });
  }

  const payment = await prisma.payment.findFirst({
    where: { reservationId: id, type: "deposit", status: "authorized" },
    orderBy: { createdAt: "desc" },
  });
  if (!payment?.transactionId) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }

  const result = await getPaymentProvider().release(payment.transactionId);
  if (result.status !== "released") {
    return NextResponse.json({ error: "Impossible de libérer le dépôt" }, { status: 502 });
  }

  await prisma.payment.update({ where: { id: payment.id }, data: { status: "released" } });
  await prisma.reservation.update({ where: { id }, data: { depositStatus: "released" } });

  return NextResponse.json({ depositStatus: "released" });
}
