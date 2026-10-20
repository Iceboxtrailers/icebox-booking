import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public, read-only — tells the booking page whether a real account (one that can sign in)
// uses this email, so its owner is asked to sign in instead of filling out the whole form.
// Guest records are not accounts and never count here. Same information already leaks
// through the signup error, so this isn't a new exposure.
export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Courriel requis" }, { status: 400 });

  const account = await prisma.client.findFirst({ where: { email, hasAccount: true }, select: { id: true } });
  return NextResponse.json({ exists: Boolean(account) });
}
