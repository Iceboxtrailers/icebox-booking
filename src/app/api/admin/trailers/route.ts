import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { adminTrailerCreateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const ownerGuard = await requireOwner();
  if (ownerGuard.error) return ownerGuard.error;

  const body = await request.json().catch(() => null);
  const parsed = adminTrailerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const trailer = await prisma.trailer.create({ data: parsed.data });
  return NextResponse.json(trailer);
}
