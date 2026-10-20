import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  // Only real accounts count: records kept for guest bookings are not accounts, and the new account
  // does not inherit their history.
  const existing = await prisma.client.findFirst({
    where: { email: parsed.data.email, hasAccount: true },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec ce courriel" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  try {
    const client = await prisma.client.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        passwordHash,
        hasAccount: true,
        marketingOptIn: parsed.data.marketingOptIn ?? false,
      },
    });
    return NextResponse.json({ id: client.id, email: client.email });
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the partial unique index lets only one through.
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Un compte existe déjà avec ce courriel" }, { status: 409 });
    }
    throw error;
  }
}
