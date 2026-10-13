import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { nights } from "@/lib/dates";
import type { DeliveryOption } from "@/lib/constants";
import { buildInvoicePayload } from "@/lib/accounting/invoice";
import { CONNECTION_ID, createInvoice, findOrCreateCustomer } from "@/lib/accounting/quickbooks";

export type SyncResult =
  | { status: "synced"; invoiceNumber: string | null }
  | { status: "skipped" | "not_configured"; message: string }
  | { status: "failed"; message: string };

const SYNCABLE_STATUSES = ["confirmed", "in_progress", "completed"];

// Creates the client and the invoice in QuickBooks Online for a confirmed
// reservation. Never throws: an accounting failure must not undo a booking —
// it is recorded on the reservation and can be retried from the console.
export async function syncReservationToQuickBooks(
  reservationId: string,
  opts: { force?: boolean; actorAdminId?: string } = {},
): Promise<SyncResult> {
  try {
    const connection = await prisma.accountingConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!connection) return { status: "not_configured", message: "QuickBooks n'est pas connecté" };

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { client: true, trailer: true },
    });
    if (!reservation) return { status: "skipped", message: "Réservation introuvable" };
    if (reservation.qbInvoiceId) return { status: "synced", invoiceNumber: reservation.qbInvoiceNumber };
    if (!SYNCABLE_STATUSES.includes(reservation.status)) {
      return { status: "skipped", message: "La réservation n'est pas confirmée" };
    }
    if (reservation.isTest) return { status: "skipped", message: "Réservation test" };
    if (!opts.force && reservation.createdAt < connection.syncFromDate) {
      return { status: "skipped", message: "Réservation antérieure à la connexion QuickBooks" };
    }
    if (!connection.taxCodeId || !connection.rentalItemId || !connection.transportItemId) {
      return { status: "not_configured", message: "Configuration QuickBooks incomplète (compte de revenus et taxes)" };
    }

    // Compare-and-set: one sync per reservation at a time, so a double
    // confirmation can never create two invoices.
    const { count } = await prisma.reservation.updateMany({
      where: { id: reservationId, qbSyncStatus: { in: ["none", "failed", "skipped"] } },
      data: { qbSyncStatus: "syncing", qbSyncError: null },
    });
    if (count !== 1) return { status: "skipped", message: "Synchronisation déjà en cours" };

    try {
      const customerId =
        reservation.client.qbCustomerId ??
        (await findOrCreateCustomer({
          firstName: reservation.client.firstName,
          lastName: reservation.client.lastName,
          company: reservation.client.company,
          email: reservation.client.email,
          phone: reservation.client.phone,
          billingAddress: reservation.client.billingAddress,
          billingCity: reservation.client.billingCity,
          billingProvince: reservation.client.billingProvince,
          billingPostalCode: reservation.client.billingPostalCode,
        }));
      if (customerId !== reservation.client.qbCustomerId) {
        await prisma.client.update({ where: { id: reservation.clientId }, data: { qbCustomerId: customerId } });
      }

      const pickup = reservation.pickupDate?.toISOString().slice(0, 10) ?? null;
      const ret = reservation.returnDate?.toISOString().slice(0, 10) ?? null;
      const payload = buildInvoicePayload(
        {
          reservationId,
          trailerSize: reservation.trailer?.size ?? null,
          pickupDate: pickup,
          returnDate: ret,
          nights: pickup && ret ? nights(pickup, ret) : null,
          totalCents: reservation.totalAmount,
          deliveryFeeCents: reservation.deliveryFeeCents,
          deliveryOption: reservation.deliveryOption as DeliveryOption,
          deliveryDistanceKm: reservation.deliveryDistanceKm,
          clientEmail: reservation.client.email,
        },
        {
          customerId,
          rentalItemId: connection.rentalItemId,
          transportItemId: connection.transportItemId,
          taxCodeId: connection.taxCodeId,
        },
        new Date().toISOString().slice(0, 10),
      );

      const invoice = await createInvoice(payload);
      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          qbInvoiceId: invoice.id,
          qbInvoiceNumber: invoice.docNumber,
          qbSyncStatus: "synced",
          qbSyncError: null,
          qbSyncedAt: new Date(),
        },
      });
      await logAudit({
        action: "quickbooks_invoice_created",
        reservationId,
        actor: opts.actorAdminId ? { type: "admin", id: opts.actorAdminId } : { type: "system" },
        details: { invoiceId: invoice.id, invoiceNumber: invoice.docNumber, customerId },
      });
      return { status: "synced", invoiceNumber: invoice.docNumber };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { qbSyncStatus: "failed", qbSyncError: message.slice(0, 500) },
      });
      await logAudit({
        action: "quickbooks_sync_failed",
        reservationId,
        actor: opts.actorAdminId ? { type: "admin", id: opts.actorAdminId } : { type: "system" },
        details: { message: message.slice(0, 500) },
      });
      return { status: "failed", message };
    }
  } catch (error) {
    console.error("QuickBooks sync error", error);
    return { status: "failed", message: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}
