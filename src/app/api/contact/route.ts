import { NextResponse } from "next/server";
import { getMailer } from "@/lib/email";
import { contactSchema } from "@/lib/validation";

const CONTACT_INBOX = "info@iceboxtrailers.ca";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const { topic, name, email, phone, message } = parsed.data;
  await getMailer().send({
    to: CONTACT_INBOX,
    subject: `IceBox — Nouvelle demande (${topic})`,
    html: `
      <div style="font-family: sans-serif; color: #1B2733;">
        <h2>Nouvelle demande — ${topic}</h2>
        <p><strong>Nom :</strong> ${name}</p>
        <p><strong>Courriel :</strong> ${email}</p>
        ${phone ? `<p><strong>Téléphone :</strong> ${phone}</p>` : ""}
        <p><strong>Message :</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
