import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const resetTokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const client = await prisma.client.findFirst({
    where: { resetTokenHash, resetTokenExpiresAt: { gt: new Date() } },
  });
  if (!client) {
    return NextResponse.json({ error: "Ce lien de réinitialisation est invalide ou expiré" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.client.update({
    where: { id: client.id },
    data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
  });

  return NextResponse.json({ ok: true });
}
