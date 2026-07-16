import { prisma } from "@/lib/prisma";
import { hasConflict } from "@/lib/availability";
import { getMailer } from "@/lib/email";
import { confirmationEmail } from "@/lib/email/templates";

export class ReservationConfirmError extends Error {}

// Re-validates everything the wizard already checked step-by-step, in case
// state changed since (e.g. another booking took the slot meanwhile), then
// finalizes the reservation and sends the confirmation email.
export async function confirmReservation(reservationId: string, clientId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { client: true, trailer: true, contract: true },
  });

  if (!reservation || reservation.clientId !== clientId) {
    throw new ReservationConfirmError("Introuvable");
  }
  if (reservation.status === "confirmed") {
    return reservation;
  }
  if (reservation.status !== "pending") {
    throw new ReservationConfirmError("Cette réservation n'est plus modifiable");
  }
  if (!reservation.trailer || !reservation.pickupDate || !reservation.returnDate) {
    throw new ReservationConfirmError("Sélectionnez d'abord une remorque et des dates");
  }
  if (reservation.contract?.signatureStatus !== "signed") {
    throw new ReservationConfirmError("Le contrat doit être signé");
  }
  if (reservation.depositStatus !== "authorized") {
    throw new ReservationConfirmError("Le dépôt doit être autorisé");
  }

  const start = reservation.pickupDate.toISOString().slice(0, 10);
  const end = reservation.returnDate.toISOString().slice(0, 10);
  const conflicting = await hasConflict(reservation.trailerId!, start, end, reservation.id);
  if (conflicting) {
    throw new ReservationConfirmError(
      "Cette remorque n'est plus disponible pour ces dates, veuillez recommencer la sélection"
    );
  }

  const confirmed = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "confirmed" },
    include: { client: true, trailer: true, contract: true },
  });

  const { subject, html } = confirmationEmail({
    firstName: confirmed.client.firstName,
    trailerModel: confirmed.trailer!.model,
    trailerType: confirmed.trailer!.type,
    trailerSize: confirmed.trailer!.size,
    start,
    end,
    totalCents: confirmed.totalAmount,
    contractPdfUrl: confirmed.contract?.pdfUrl ?? "",
  });
  await getMailer().send({ to: confirmed.client.email, subject, html });

  return confirmed;
}
