import { prisma } from "@/lib/prisma";

// The architecture doc's "historique_location" is not a table — it's this
// derived join over reservations, reused later by the internal CRM panel.
export async function getRentalHistory(clientId: string) {
  return prisma.reservation.findMany({
    where: { clientId },
    include: { trailer: true, contract: true, payments: true },
    orderBy: { createdAt: "desc" },
  });
}
