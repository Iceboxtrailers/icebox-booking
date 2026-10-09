import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditActor = { type: "admin" | "client" | "system" | "stripe"; id?: string | null };

// Insert-only on purpose: nothing in the app updates or deletes audit rows.
export async function logAudit(p: {
  action: string;
  reservationId?: string | null;
  actor: AuditActor;
  details?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: p.action,
        reservationId: p.reservationId ?? null,
        actorType: p.actor.type,
        actorId: p.actor.id ?? null,
        details: p.details,
      },
    });
  } catch (error) {
    // An audit failure must never undo a money movement that already happened.
    console.error("Audit log write failed", p.action, error);
  }
}
