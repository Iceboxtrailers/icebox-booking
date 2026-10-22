import { prisma } from "@/lib/prisma";
import { actionsInCategory, actorLabel, clientIdOfDocumentEvent, describeAuditEvent, type AuditCategory } from "@/lib/admin/audit-events";
import { fmt } from "@/lib/dates";

// Read side of the audit log (the app only ever inserts into it, see src/lib/audit.ts). Owner-only page.

export const AUDIT_PAGE_SIZE = 40;
const PROBLEM_WINDOW_DAYS = 7;

export type AuditEntry = {
  id: string;
  at: Date;
  title: string;
  detail: string | null;
  problem: boolean;
  actor: string;
  // `exists` is false once the booking has been deleted (the entries about it stay).
  reservation: { id: string; label: string; year: number; month: number; exists: boolean } | null;
};

export type AuditPage = { entries: AuditEntry[]; nextCursor: string | null };

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// How many things went wrong recently: shown as a badge on the "Journal" tab.
export async function countRecentProblems(): Promise<number> {
  return prisma.auditLog.count({
    where: { createdAt: { gte: daysAgo(PROBLEM_WINDOW_DAYS) }, action: { in: actionsInCategory("problemes") } },
  });
}

export async function getAuditPage(opts: {
  category: AuditCategory | null; // null: everything, including actions this page does not know
  days: number;
  reservationId?: string;
  before?: string; // id of the last entry of the previous page
}): Promise<AuditPage> {
  const rows = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: daysAgo(opts.days) },
      ...(opts.category ? { action: { in: actionsInCategory(opts.category) } } : {}),
      ...(opts.reservationId ? { reservationId: opts.reservationId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: AUDIT_PAGE_SIZE + 1,
    ...(opts.before ? { cursor: { id: opts.before }, skip: 1 } : {}),
  });
  const hasMore = rows.length > AUDIT_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, AUDIT_PAGE_SIZE) : rows;

  // Names behind the ids, looked up once for the whole page.
  const adminIds = new Set<string>();
  const clientIds = new Set<string>();
  const reservationIds = new Set<string>();
  for (const row of page) {
    if (row.actorType === "admin" && row.actorId) adminIds.add(row.actorId);
    if (row.actorType === "client" && row.actorId) clientIds.add(row.actorId);
    const documentClient = clientIdOfDocumentEvent(row.action, row.details);
    if (documentClient) clientIds.add(documentClient);
    if (row.reservationId) reservationIds.add(row.reservationId);
  }
  const [admins, clients, reservations] = await Promise.all([
    adminIds.size ? prisma.adminUser.findMany({ where: { id: { in: [...adminIds] } }, select: { id: true, username: true } }) : [],
    clientIds.size ? prisma.client.findMany({ where: { id: { in: [...clientIds] } }, select: { id: true, firstName: true, lastName: true } }) : [],
    reservationIds.size
      ? prisma.reservation.findMany({
          where: { id: { in: [...reservationIds] } },
          select: { id: true, pickupDate: true, returnDate: true, client: { select: { firstName: true, lastName: true } }, trailer: { select: { name: true } } },
        })
      : [],
  ]);
  const adminName = new Map(admins.map((a) => [a.id, a.username]));
  const clientName = new Map(clients.map((c) => [c.id, `${c.firstName} ${c.lastName}`]));
  const reservationInfo = new Map(reservations.map((r) => [r.id, r]));

  const entries = page.map<AuditEntry>((row) => {
    const documentClient = clientIdOfDocumentEvent(row.action, row.details);
    const described = describeAuditEvent(row, { clientName: documentClient ? (clientName.get(documentClient) ?? "Client supprimé") : null });
    const reservation = row.reservationId ? reservationInfo.get(row.reservationId) : null;
    const pickup = reservation?.pickupDate ?? null;
    const actorName = row.actorId ? (row.actorType === "admin" ? adminName.get(row.actorId) : clientName.get(row.actorId)) : null;
    return {
      id: row.id,
      at: row.createdAt,
      ...described,
      actor: actorLabel(row.actorType, actorName ?? null),
      reservation: row.reservationId
        ? {
            id: row.reservationId,
            label: reservation
              ? `${reservation.client.firstName} ${reservation.client.lastName}${pickup && reservation.returnDate ? ` · ${fmt(pickup.toISOString().slice(0, 10))} → ${fmt(reservation.returnDate.toISOString().slice(0, 10))}` : ""}${reservation.trailer ? ` · ${reservation.trailer.name}` : ""}`
              : "Réservation supprimée",
            year: pickup ? pickup.getUTCFullYear() : new Date().getUTCFullYear(),
            month: pickup ? pickup.getUTCMonth() + 1 : new Date().getUTCMonth() + 1,
            exists: Boolean(reservation),
          }
        : null,
    };
  });

  return { entries, nextCursor: hasMore ? page[page.length - 1].id : null };
}
