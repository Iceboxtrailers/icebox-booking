import { prisma } from "@/lib/prisma";
import { getMailer } from "@/lib/email";
import { confirmationEmail } from "@/lib/email/templates";
import { loadContractAttachment } from "@/lib/email/attachments";
import { logAudit } from "@/lib/audit";
import { DELIVERY_OPTION_LABEL_FR, holdsSlot } from "@/lib/constants";
import type { DeliveryOption } from "@/lib/constants";

export type SendConfirmationResult =
  | { ok: true; to: string; attached: boolean }
  | { ok: false; reason: "not_found" | "not_confirmed" | "send_failed"; message: string };

// The confirmation e-mail of a booking: the summary, and the signed contract as a PDF when there is one. Sent
// when the client finishes booking, and again on request from the console (`resentBy`). It does not throw:
// a mail outage must never undo or fail a booking, so a failure is written to the audit log (where the
// journal shows it) and returned.
export async function sendConfirmationEmail(reservationId: string, opts: { resentBy?: string } = {}): Promise<SendConfirmationResult> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { client: true, trailer: true, contract: true },
  });
  if (!reservation) return { ok: false, reason: "not_found", message: "Réservation introuvable." };
  if (!holdsSlot(reservation.status) || !reservation.trailer || !reservation.pickupDate || !reservation.returnDate) {
    return { ok: false, reason: "not_confirmed", message: "Cette réservation n'est pas confirmée." };
  }

  const deliveryLabel =
    reservation.deliveryOption !== "pickup"
      ? `${DELIVERY_OPTION_LABEL_FR[reservation.deliveryOption as DeliveryOption]}${reservation.usageLocation ? ` — ${reservation.usageLocation}` : ""}`
      : null;
  const resend = opts.resentBy !== undefined;
  const actor = resend ? ({ type: "admin", id: opts.resentBy } as const) : ({ type: "system" } as const);

  try {
    // Only a signed contract is attached: an unsigned one is not what the message says it is.
    const contract = await loadContractAttachment(reservation.contract?.signatureStatus === "signed" ? reservation.contract.pdfUrl : null);
    const { subject, html } = confirmationEmail({
      firstName: reservation.client.firstName,
      trailerSize: reservation.trailer.size,
      start: reservation.pickupDate.toISOString().slice(0, 10),
      end: reservation.returnDate.toISOString().slice(0, 10),
      totalCents: reservation.totalAmount,
      deliveryLabel,
      hasContract: Boolean(contract),
      cardOnFile: reservation.depositStatus === "card_on_file" || reservation.depositStatus === "authorized",
    });
    await getMailer().send({
      to: reservation.client.email,
      subject,
      html,
      attachments: contract ? [contract] : undefined,
    });
    if (resend) {
      await logAudit({
        action: "email_resent",
        reservationId,
        actor,
        details: { kind: "client_confirmation", to: reservation.client.email, attached: Boolean(contract) },
      });
    }
    return { ok: true, to: reservation.client.email, attached: Boolean(contract) };
  } catch (error) {
    console.error("Confirmation email failed", error);
    const message = error instanceof Error ? error.message.slice(0, 300) : "unknown";
    await logAudit({
      action: "email_failed",
      reservationId,
      actor,
      details: { kind: "client_confirmation", message, ...(resend ? { resend: true } : {}) },
    });
    return { ok: false, reason: "send_failed", message };
  }
}

// The reason the last attempt to send this booking's confirmation e-mail failed, or null when the latest
// attempt worked (or none was recorded). Shown on the booking sheet.
export async function getConfirmationEmailProblem(reservationId: string): Promise<string | null> {
  const last = await prisma.auditLog.findFirst({
    where: { reservationId, action: { in: ["email_failed", "email_resent"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { action: true, details: true },
  });
  if (last?.action !== "email_failed") return null;
  const details = last.details && typeof last.details === "object" && !Array.isArray(last.details) ? (last.details as Record<string, unknown>) : {};
  if (details.kind !== "client_confirmation") return null;
  return typeof details.message === "string" && details.message ? details.message : "Raison inconnue";
}
