import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin-auth";
import { syncReservationToQuickBooks } from "@/lib/accounting/sync";
import { quickBooksInvoiceState } from "@/lib/accounting/status";

// Owner-only: what QuickBooks knows about this booking (invoice sent or not, and to which company).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const { id } = await params;
  const state = await quickBooksInvoiceState(id);
  if (!state) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(state);
}

// Owner-only manual (re)send of one reservation's invoice to QuickBooks. Forced:
// it also covers reservations created before QuickBooks was connected.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const { id } = await params;
  const result = await syncReservationToQuickBooks(id, { force: true, actorAdminId: guard.admin.id });
  if (result.status === "failed") return NextResponse.json({ error: result.message }, { status: 502 });
  if (result.status === "synced") return NextResponse.json(result);
  return NextResponse.json({ error: result.message }, { status: 409 });
}
