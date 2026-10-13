import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/admin-auth";
import { CONNECTION_ID, quickBooksConfigured } from "@/lib/accounting/quickbooks";
import { QuickBooksPanel } from "@/components/admin/QuickBooksPanel";

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  await requireOwnerPage();
  const { connected, error } = await searchParams;

  const connection = await prisma.accountingConnection.findUnique({
    where: { id: CONNECTION_ID },
    select: { realmId: true, syncFromDate: true, taxCodeId: true, rentalItemId: true, transportItemId: true },
  });
  const failed = connection
    ? await prisma.reservation.findMany({
        where: { qbSyncStatus: "failed" },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, qbSyncError: true, client: { select: { firstName: true, lastName: true } } },
      })
    : [];
  const syncedCount = connection ? await prisma.reservation.count({ where: { qbSyncStatus: "synced" } }) : 0;

  return (
    <div>
      <h1 className="font-heading mb-6 text-2xl">Comptabilité — QuickBooks</h1>
      <QuickBooksPanel
        appConfigured={quickBooksConfigured()}
        environment={process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "production" : "sandbox"}
        connection={
          connection
            ? {
                realmId: connection.realmId,
                syncFromDate: connection.syncFromDate.toISOString(),
                ready: Boolean(connection.taxCodeId && connection.rentalItemId && connection.transportItemId),
              }
            : null
        }
        syncedCount={syncedCount}
        failed={failed.map((f) => ({
          id: f.id,
          client: `${f.client.firstName} ${f.client.lastName}`,
          error: f.qbSyncError ?? "",
        }))}
        flash={connected ? "connected" : error ?? null}
      />
    </div>
  );
}
