import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { emailDeliveryConfigured, getMailer } from "@/lib/email";
import { depositLinkEmail } from "@/lib/email/templates";

const LINK_VALID_DAYS = 7;

// Creates a secure link the client opens on their own phone to confirm the
// hold themselves (3-D Secure, replaced card, or no card saved yet).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const { admin } = guard;

  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { client: true } });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (reservation.status !== "confirmed" && reservation.status !== "in_progress") {
    return NextResponse.json({ error: "La réservation doit être confirmée" }, { status: 409 });
  }
  if (!["none", "card_on_file", "expired", "authorized"].includes(reservation.depositStatus)) {
    return NextResponse.json({ error: "Aucune retenue à placer pour le moment" }, { status: 409 });
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_VALID_DAYS * 24 * 60 * 60 * 1000);
  await prisma.reservation.update({
    where: { id },
    data: { depositToken: token, depositTokenExpiresAt: expiresAt },
  });
  await logAudit({
    action: "deposit_link_created",
    reservationId: id,
    actor: { type: "admin", id: admin.id },
    details: { expiresAt: expiresAt.toISOString() },
  });

  const origin = new URL(request.url).origin;
  const url = `${origin}/depot/${token}`;

  // Optionally email the link straight to the client (body: { sendEmail: true }).
  const body = (await request.json().catch(() => null)) as { sendEmail?: boolean } | null;
  let emailed = false;
  let emailError: string | null = null;
  if (body?.sendEmail) {
    try {
      const { subject, html } = depositLinkEmail({
        firstName: reservation.client.firstName,
        link: url,
        expiresOn: expiresAt.toISOString().slice(0, 10),
      });
      await getMailer().send({ to: reservation.client.email, subject, html });
      emailed = emailDeliveryConfigured();
      if (!emailed) emailError = "L'envoi de courriels n'est pas encore configuré — copiez le lien.";
      await logAudit({
        action: "deposit_link_emailed",
        reservationId: id,
        actor: { type: "admin", id: admin.id },
        details: { to: reservation.client.email, delivered: emailed },
      });
    } catch (error) {
      console.error("Deposit link email failed", error);
      emailError = "Le courriel n'a pas pu être envoyé — copiez le lien.";
    }
  }

  return NextResponse.json({ url, expiresAt: expiresAt.toISOString(), emailed, emailError });
}
