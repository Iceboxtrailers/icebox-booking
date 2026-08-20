import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminId } from "@/lib/session";
import { adminClientCreateSchema } from "@/lib/validation";

const CLIENT_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  company: true,
  email: true,
  phone: true,
  status: true,
  billingCity: true,
  billingProvince: true,
  createdAt: true,
  _count: { select: { reservations: true } },
} as const;

export async function GET() {
  const adminId = await getCurrentAdminId();
  if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const clients = await prisma.client.findMany({
    select: CLIENT_LIST_SELECT,
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json(clients);
}

export async function POST(request: Request) {
  const adminId = await getCurrentAdminId();
  if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = adminClientCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const existing = await prisma.client.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec ce courriel" }, { status: 409 });
  }

  // Walk-in/phone bookings don't set their own password — a random,
  // never-shown one satisfies the schema; "mot de passe oublié" gets the
  // client into their own portal later if they ever want it.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

  const client = await prisma.client.create({
    data: { ...parsed.data, passwordHash },
    select: CLIENT_LIST_SELECT,
  });

  return NextResponse.json(client);
}
