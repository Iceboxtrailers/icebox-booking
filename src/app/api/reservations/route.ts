import { NextResponse } from "next/server";
import { getCurrentClientId } from "@/lib/session";
import { startOrResumeReservation } from "@/lib/reservations/start";

export async function POST() {
  const clientId = await getCurrentClientId();
  if (!clientId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const reservation = await startOrResumeReservation(clientId);
  if (!reservation) {
    return NextResponse.json({ error: "Trop de réservations commencées aujourd'hui. Réessayez demain ou appelez-nous." }, { status: 429 });
  }

  return NextResponse.json({ id: reservation.id });
}
