import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { adminClientUpdateSchema } from "@/lib/validation";
import { getClientDocuments } from "@/lib/admin/documents";

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
  const ownerGuard = await requireOwner();
  if (ownerGuard.error) return ownerGuard.error;

  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, select: CLIENT_DETAIL_SELECT });
  if (!client) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  return NextResponse.json({ ...client, documents: await getClientDocuments(id) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ownerGuard = await requireOwner();
  if (ownerGuard.error) return ownerGuard.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminClientUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  // The email must be unique among real accounts only; admin-only records may share one.
  if (parsed.data.email) {
    const current = await prisma.client.findUnique({ where: { id }, select: { hasAccount: true } });
    if (!current) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    if (current.hasAccount) {
      const taken = await prisma.client.findFirst({
        where: { email: parsed.data.email, hasAccount: true, NOT: { id } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json({ error: "Un compte existe déjà avec ce courriel" }, { status: 409 });
      }
    }
  }

  const client = await prisma.client.update({
    where: { id },
    data: parsed.data,
    select: CLIENT_DETAIL_SELECT,
  });

  return NextResponse.json(client);
}
