import { NextResponse } from "next/server";
import { getCurrentClientId } from "@/lib/session";
import { confirmReservation, ReservationConfirmError } from "@/lib/reservations/confirm";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  try {
    const reservation = await confirmReservation(id, clientId);
    return NextResponse.json(reservation);
  } catch (err) {
    if (err instanceof ReservationConfirmError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
