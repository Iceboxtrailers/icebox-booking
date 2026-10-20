import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { guestStartSchema } from "@/lib/validation";
import { GUEST_START_LIMIT, GUEST_TOKEN_TTL_MS, hashGuestToken, newGuestToken } from "@/lib/guest";

// Starts a booking without an account: creates an admin-only record for this booking and
// returns a one-time token the browser exchanges for a short session (provider "guest-session").
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = guestStartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { firstName, lastName, email, phone } = parsed.data;

  // A real account owns this email: its owner must sign in (with a password or an emailed link).
  const account = await prisma.client.findFirst({ where: { email, hasAccount: true }, select: { id: true } });
  if (account) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec ce courriel. Connectez-vous pour continuer.", code: "account_exists" },
      { status: 409 },
    );
  }

  // Starting a new record must not get around a suspension or a blacklisting.
  const blocked = await prisma.client.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: { not: "active" } },
    select: { id: true },
  });
  if (blocked) {
    return NextResponse.json(
      { error: "Impossible de poursuivre la réservation en ligne. Veuillez nous joindre au 581 889-2093." },
      { status: 403 },
    );
  }

  const recent = await prisma.client.count({
    where: { hasAccount: false, createdAt: { gte: new Date(Date.now() - GUEST_START_LIMIT.windowMs) } },
  });
  if (recent >= GUEST_START_LIMIT.count) {
    return NextResponse.json(
      { error: "Trop de demandes pour le moment. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  const token = newGuestToken();
  await prisma.client.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      hasAccount: false,
      // Never shown and never usable: guest records cannot sign in with a password.
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
      resetTokenHash: hashGuestToken(token),
      resetTokenExpiresAt: new Date(Date.now() + GUEST_TOKEN_TTL_MS),
    },
  });

  return NextResponse.json({ token });
}
