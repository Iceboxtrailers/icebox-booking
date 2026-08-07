import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getMailer } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email/templates";
import { forgotPasswordSchema } from "@/lib/validation";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { email: parsed.data.email } });

  // Always respond the same way whether or not the email exists, so this
  // endpoint can't be used to check which emails have accounts.
  if (client) {
    const token = randomBytes(32).toString("hex");
    const resetTokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.client.update({
      where: { id: client.id },
      data: { resetTokenHash, resetTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });

    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/reinitialiser-mot-de-passe?token=${token}`;
    const { subject, html } = passwordResetEmail({ firstName: client.firstName, resetUrl });
    await getMailer().send({ to: client.email, subject, html });
  }

  return NextResponse.json({ ok: true });
}
