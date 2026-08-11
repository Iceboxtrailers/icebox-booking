import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { updateAccountSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const existing = await prisma.client.findUnique({ where: { email: parsed.data.email } });
  if (existing && existing.id !== clientId) {
    return NextResponse.json({ error: "Un compte existe déjà avec ce courriel" }, { status: 409 });
  }

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: {
      email: parsed.data.email,
      phone: parsed.data.phone,
      billingAddress: parsed.data.billingAddress,
      billingCity: parsed.data.billingCity,
      billingProvince: parsed.data.billingProvince,
      billingPostalCode: parsed.data.billingPostalCode,
    },
  });

  return NextResponse.json({
    email: updated.email,
    phone: updated.phone,
    billingAddress: updated.billingAddress,
    billingCity: updated.billingCity,
    billingProvince: updated.billingProvince,
    billingPostalCode: updated.billingPostalCode,
  });
}
