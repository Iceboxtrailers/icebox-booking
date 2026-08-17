import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId, getCurrentAdminId } from "@/lib/session";
import { getStorage } from "@/lib/providers/storage";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

async function isOwnedByClient(segments: string[], clientId: string): Promise<boolean> {
  const [kind, second] = segments;

  if (kind === "documents") {
    return second === clientId;
  }

  if (kind === "contracts" || kind === "signatures") {
    const reservationId = second?.replace(/\.[^.]+$/, "");
    if (!reservationId) return false;
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { clientId: true },
    });
    return reservation?.clientId === clientId;
  }

  return false;
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const [kind] = segments;

  if (kind === "trailers") {
    // Fleet photos are admin-managed assets, not tied to any one client.
    const adminId = await getCurrentAdminId();
    if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  } else {
    const clientId = await getCurrentClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const owned = await isOwnedByClient(segments, clientId);
    if (!owned) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }
  }

  const ext = segments[segments.length - 1].split(".").pop() ?? "";
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

  try {
    const data = await getStorage().read(segments.join("/"));
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
