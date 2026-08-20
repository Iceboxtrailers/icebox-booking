import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminId } from "@/lib/session";
import { adminClientUpdateSchema } from "@/lib/validation";

const CLIENT_DETAIL_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  company: true,
  email: true,
  phone: true,
  status: true,
  verificationStatus: true,
  internalNote: true,
  billingAddress: true,
  billingCity: true,
  billingProvince: true,
  billingPostalCode: true,
  createdAt: true,
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getCurrentAdminId();
  if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, select: CLIENT_DETAIL_SELECT });
  if (!client) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  return NextResponse.json(client);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getCurrentAdminId();
  if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminClientUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  if (parsed.data.email) {
    const existing = await prisma.client.findUnique({ where: { email: parsed.data.email } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "Un compte existe déjà avec ce courriel" }, { status: 409 });
    }
  }

  const client = await prisma.client.update({
    where: { id },
    data: parsed.data,
    select: CLIENT_DETAIL_SELECT,
  });

  return NextResponse.json(client);
}
