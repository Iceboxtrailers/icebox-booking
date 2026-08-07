import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  const currentOk = await bcrypt.compare(parsed.data.currentPassword, client.passwordHash);
  if (!currentOk) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.client.update({ where: { id: clientId }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
