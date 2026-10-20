import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const ownerGuard = await requireOwner();
  if (ownerGuard.error) return ownerGuard.error;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const rows = await prisma.client.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, hasAccount: true, createdAt: true },
    take: 60,
    orderBy: { lastName: "asc" },
  });

  // One person who booked several times has several admin-only records with the same email:
  // show the oldest one only (the record staff may have filled in).
  const seen = new Set<string>();
  const clients = [...rows]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .filter((row) => {
      if (row.hasAccount) return true;
      const key = row.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr", { sensitivity: "base" }))
    .slice(0, 10)
    .map(({ id, firstName, lastName, email, phone }) => ({ id, firstName, lastName, email, phone }));

  return NextResponse.json(clients);
}
