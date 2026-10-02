import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public, read-only — lets the guest-checkout page greet a returning
// customer instead of failing on "un compte existe déjà" after they've
// filled out the whole form. Same information already leaks through that
// signup error today, so this isn't a new exposure.
export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Courriel requis" }, { status: 400 });

  const client = await prisma.client.findUnique({ where: { email }, select: { id: true } });
  return NextResponse.json({ exists: Boolean(client) });
}
