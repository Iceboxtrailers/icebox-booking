import { prisma } from "@/lib/prisma";
import { CONNECTION_ID } from "@/lib/accounting/quickbooks";

export type QuickBooksInvoiceState = {
  connected: boolean;
  // Items and tax code chosen: until then nothing can be sent.
  ready: boolean;
  // "sandbox": Intuit's test company, not the owner's real QuickBooks.
  environment: "sandbox" | "production";
  status: "none" | "syncing" | "synced" | "failed" | "skipped";
  invoiceId: string | null;
  invoiceNumber: string | null;
  syncedAt: string | null;
  error: string | null;
};

// What the reservation sheet says about the invoice of one booking. Null when the booking does not exist.
export async function quickBooksInvoiceState(reservationId: string): Promise<QuickBooksInvoiceState | null> {
  const [reservation, connection] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { qbSyncStatus: true, qbInvoiceId: true, qbInvoiceNumber: true, qbSyncedAt: true, qbSyncError: true },
    }),
    prisma.accountingConnection.findUnique({
      where: { id: CONNECTION_ID },
      select: { taxCodeId: true, rentalItemId: true, transportItemId: true },
    }),
  ]);
  if (!reservation) return null;
  return {
    connected: Boolean(connection),
    ready: Boolean(connection?.taxCodeId && connection.rentalItemId && connection.transportItemId),
    environment: process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "production" : "sandbox",
    status: reservation.qbSyncStatus as QuickBooksInvoiceState["status"],
    invoiceId: reservation.qbInvoiceId,
    invoiceNumber: reservation.qbInvoiceNumber,
    syncedAt: reservation.qbSyncedAt?.toISOString() ?? null,
    error: reservation.qbSyncError,
  };
}
