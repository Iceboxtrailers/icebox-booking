import { prisma } from "@/lib/prisma";
import { hasConflict } from "@/lib/availability";
import { getMailer } from "@/lib/email";
import { confirmationEmail, internalNewReservationEmail } from "@/lib/email/templates";
import { loadContractAttachment } from "@/lib/email/attachments";
import { syncReservationToQuickBooks } from "@/lib/accounting/sync";
import { logAudit } from "@/lib/audit";
import { siteUrl } from "@/lib/site";
import { DELIVERY_OPTION_LABEL_FR } from "@/lib/constants";
import type { DeliveryOption } from "@/lib/constants";

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
  if (reservation.depositStatus !== "card_on_file" && reservation.depositStatus !== "authorized") {
    throw new ReservationConfirmError("Une carte doit être enregistrée pour le dépôt");
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

  await syncReservationToQuickBooks(reservationId);

  // Emails are best effort: a mail outage must never undo or fail a confirmed booking.
  const deliveryLabel =
    confirmed.deliveryOption !== "pickup"
      ? `${DELIVERY_OPTION_LABEL_FR[confirmed.deliveryOption as DeliveryOption]}${confirmed.usageLocation ? ` — ${confirmed.usageLocation}` : ""}`
      : null;
  const mailer = getMailer();

  try {
    const contract = await loadContractAttachment(confirmed.contract?.pdfUrl);
    const { subject, html } = confirmationEmail({
      firstName: confirmed.client.firstName,
      trailerSize: confirmed.trailer!.size,
      start,
      end,
      totalCents: confirmed.totalAmount,
      deliveryLabel,
    });
    await mailer.send({
      to: confirmed.client.email,
      subject,
      html,
      attachments: contract ? [contract] : undefined,
    });
  } catch (error) {
    console.error("Confirmation email failed", error);
    await logAudit({
      action: "email_failed",
      reservationId,
      actor: { type: "system" },
      details: { kind: "client_confirmation", message: error instanceof Error ? error.message.slice(0, 300) : "unknown" },
    });
  }

  try {
    const internal = internalNewReservationEmail({
      clientName: `${confirmed.client.firstName} ${confirmed.client.lastName}`,
      clientEmail: confirmed.client.email,
      clientPhone: confirmed.client.phone,
      trailerSize: confirmed.trailer!.size,
      start,
      end,
      totalCents: confirmed.totalAmount,
      deliveryLabel,
      adminUrl: `${siteUrl()}/dashboard`,
    });
    await mailer.send({ to: "info@iceboxtrailers.ca", subject: internal.subject, html: internal.html });
  } catch (error) {
    console.error("Internal reservation notice failed", error);
  }

  return confirmed;
}
