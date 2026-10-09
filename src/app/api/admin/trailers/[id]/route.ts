import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { adminTrailerUpdateSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ownerGuard = await requireOwner();
  if (ownerGuard.error) return ownerGuard.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminTrailerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const trailer = await prisma.trailer.update({ where: { id }, data: parsed.data });
  return NextResponse.json(trailer);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ownerGuard = await requireOwner();
  if (ownerGuard.error) return ownerGuard.error;

  const { id } = await params;
  const referenced = await prisma.reservation.findFirst({ where: { trailerId: id }, select: { id: true } });
  if (referenced) {
    return NextResponse.json(
      { error: "Cette remorque a des réservations et ne peut pas être supprimée" },
      { status: 409 }
    );
  }

  await prisma.trailer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
