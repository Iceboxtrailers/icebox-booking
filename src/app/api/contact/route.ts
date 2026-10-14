import { NextResponse } from "next/server";
import { getMailer } from "@/lib/email";
import { contactRequestEmail } from "@/lib/email/templates";
import { contactSchema } from "@/lib/validation";

const CONTACT_INBOX = "info@iceboxtrailers.ca";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const { subject, html } = contactRequestEmail(parsed.data);
  try {
    // Reply-To is the visitor, so answering from the inbox goes straight to them.
    await getMailer().send({ to: CONTACT_INBOX, subject, html, replyTo: parsed.data.email });
  } catch (error) {
    console.error("Contact email failed", error);
    return NextResponse.json(
      { error: "Votre message n'a pas pu être envoyé. Veuillez réessayer ou nous appeler au 581 889-2093." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
