import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";

export async function POST() {
  const clientId = await getCurrentClientId();
  if (!clientId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const reservation = await prisma.reservation.create({
    data: { clientId },
  });

  return NextResponse.json({ id: reservation.id });
}
