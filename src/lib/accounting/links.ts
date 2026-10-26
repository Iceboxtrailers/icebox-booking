import { prisma } from "@/lib/prisma";

// The numbers QuickBooks gives to customers and invoices belong to one company file. Connect the site to another
// file (Intuit's test company first, the real one later) and they mean nothing there: a client would be sent to
// whichever customer happens to carry that number, and a booking already marked "synced" would never get its invoice.
// So when the company changes the links are forgotten, and those bookings can be sent again from their sheet.
export async function forgetQuickBooksLinks(): Promise<{ clients: number; reservations: number }> {
  const [clients, reservations] = await prisma.$transaction([
    prisma.client.updateMany({ where: { qbCustomerId: { not: null } }, data: { qbCustomerId: null } }),
    prisma.reservation.updateMany({
      where: { OR: [{ qbInvoiceId: { not: null } }, { qbSyncStatus: { not: "none" } }] },
      data: { qbInvoiceId: null, qbInvoiceNumber: null, qbSyncStatus: "none", qbSyncError: null, qbSyncedAt: null },
    }),
  ]);
  return { clients: clients.count, reservations: reservations.count };
}

// The company the site was last connected to, even after a disconnection removed the connection itself.
async function lastConnectedRealm(): Promise<string | null> {
  const last = await prisma.auditLog.findFirst({
    where: { action: "quickbooks_connected" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { details: true },
  });
  const details = last?.details;
  const realm = details && typeof details === "object" && !Array.isArray(details) ? (details as Record<string, unknown>).realmId : null;
  return typeof realm === "string" ? realm : null;
}

export type CompanyChange = { changed: false } | { changed: true; from: string; to: string; clients: number; reservations: number };

// Called when the owner connects QuickBooks. `currentRealmId` is the company of the connection being replaced, if
// there is one; after a disconnection the audit trail still remembers it. Reconnecting the same company keeps every
// link (its invoices are still there); a different one starts clean.
export async function reconcileQuickBooksCompany(newRealmId: string, currentRealmId: string | null): Promise<CompanyChange> {
  const previous = currentRealmId ?? (await lastConnectedRealm());
  if (!previous || previous === newRealmId) return { changed: false };
  return { changed: true, from: previous, to: newRealmId, ...(await forgetQuickBooksLinks()) };
}
