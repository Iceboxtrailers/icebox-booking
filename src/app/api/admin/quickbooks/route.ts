import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { CONNECTION_ID, ensureServiceItems } from "@/lib/accounting/quickbooks";
import { logAudit } from "@/lib/audit";

const settingsSchema = z.object({
  incomeAccountId: z.string().min(1, "Compte de revenus requis"),
  taxCodeId: z.string().min(1, "Code de taxe requis"),
});

// Saves the income account and tax code, and creates the two service items
// (rental, transport) in the owner's QuickBooks file if they don't exist yet.
export async function POST(request: Request) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  if (!(await prisma.accountingConnection.findUnique({ where: { id: CONNECTION_ID } }))) {
    return NextResponse.json({ error: "QuickBooks n'est pas connecté" }, { status: 409 });
  }

  try {
    const items = await ensureServiceItems(parsed.data.incomeAccountId);
    await prisma.accountingConnection.update({
      where: { id: CONNECTION_ID },
      data: { incomeAccountId: parsed.data.incomeAccountId, taxCodeId: parsed.data.taxCodeId, ...items },
    });
    await logAudit({
      action: "quickbooks_configured",
      actor: { type: "admin", id: guard.admin.id },
      details: { ...parsed.data, ...items },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("QuickBooks settings error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de configurer QuickBooks" },
      { status: 502 },
    );
  }
}

export async function DELETE() {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  await prisma.accountingConnection.deleteMany({ where: { id: CONNECTION_ID } });
  await logAudit({ action: "quickbooks_disconnected", actor: { type: "admin", id: guard.admin.id } });
  return NextResponse.json({ ok: true });
}
