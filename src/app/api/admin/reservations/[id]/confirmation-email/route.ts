import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { emailDeliveryConfigured } from "@/lib/email";
import { RATE_RULES, rejectIfOverLimit } from "@/lib/rate-limit";
import { sendConfirmationEmail } from "@/lib/reservations/confirmation-email";

// Sends the client their confirmation e-mail again (the summary and the signed contract), for example after
// a mail outage, a typo corrected in the client's address, or a lost message. Staff and owner can both do it.
// Each sending is written to the audit log, and shown in the journal.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const { id } = await params;
  if (!emailDeliveryConfigured()) {
    return NextResponse.json({ error: "L'envoi de courriels n'est pas encore configuré." }, { status: 503 });
  }
  const limited = await rejectIfOverLimit(RATE_RULES.resendConfirmation, id, "Ce courriel a déjà été renvoyé plusieurs fois. Réessayez dans une heure.");
  if (limited) return limited;

  const result = await sendConfirmationEmail(id, { resentBy: guard.admin.id });
  if (result.ok) return NextResponse.json({ ok: true, to: result.to, attached: result.attached });
  if (result.reason === "not_found") return NextResponse.json({ error: result.message }, { status: 404 });
  if (result.reason === "not_confirmed") return NextResponse.json({ error: result.message }, { status: 409 });
  return NextResponse.json({ error: `Le courriel n'a pas pu être envoyé (${result.message}).` }, { status: 502 });
}
