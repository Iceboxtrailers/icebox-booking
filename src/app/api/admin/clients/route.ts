import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { CLIENT_LIST_SELECT, getAllClients } from "@/lib/admin/clients";
import { adminClientCreateSchema } from "@/lib/validation";

export async function GET() {
  const ownerGuard = await requireOwner();
  if (ownerGuard.error) return ownerGuard.error;

  const clients = await getAllClients();

  return NextResponse.json(clients);
}

export async function POST(request: Request) {
  const ownerGuard = await requireOwner();
  if (ownerGuard.error) return ownerGuard.error;

  const body = await request.json().catch(() => null);
  const parsed = adminClientCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  // An existing record (guest booking or earlier entry) is reused, not duplicated.
  const existing = await prisma.client.findFirst({
    where: { email: { equals: parsed.data.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Ce client existe déjà : recherchez-le par son courriel" }, { status: 409 });
  }

  // Walk-in/phone bookings are admin-only records: no login, no password anyone knows.
  // The random hash only satisfies the schema.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

  const client = await prisma.client.create({
    data: { ...parsed.data, passwordHash, hasAccount: false },
    select: CLIENT_LIST_SELECT,
  });

  return NextResponse.json(client);
}
