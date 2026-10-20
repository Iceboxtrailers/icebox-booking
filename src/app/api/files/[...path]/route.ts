import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getCurrentClientId } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { getStorage } from "@/lib/providers/storage";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// How many path segments each kind of stored file has (see the routes that save them):
//   documents/<clientId>/<file>   contracts/<file>   signatures/<file>
//   trailers/<file>               inspections/<reservationId>/<file>
const SEGMENTS_BY_KIND: Record<string, number> = { documents: 3, contracts: 2, signatures: 2, trailers: 2, inspections: 3 };
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Only paths of a known shape are looked up: no "..", no empty or odd segments, so a path can
// never be steered to a file the ownership check below did not look at.
function hasKnownShape(segments: string[]): boolean {
  return (
    SEGMENTS_BY_KIND[segments[0]] === segments.length &&
    segments.every((segment) => SAFE_SEGMENT.test(segment) && !segment.includes(".."))
  );
}

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
  if (!hasKnownShape(segments)) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  const [kind] = segments;

  // The staff member is looked up in the database, so a removed account loses access at once.
  if (kind === "trailers" || kind === "inspections") {
    // Fleet photos and return-inspection photos are staff-only assets, never
    // visible to clients.
    if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  } else if (kind === "contracts" || kind === "signatures") {
    // Staff are a party to every contract, so any signed-in admin can view them.
    if (!(await getCurrentAdmin())) {
      const clientId = await getCurrentClientId();
      if (!clientId || !(await isOwnedByClient(segments, clientId))) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      }
    }
  } else {
    // Documents (licence, insurance proof): the client who uploaded them, or staff, who check them at
    // handoff. Every time staff open one it is written to the audit log.
    const admin = await getCurrentAdmin();
    if (admin) {
      await logAudit({ action: "document_viewed", actor: { type: "admin", id: admin.id }, details: { path: segments.join("/") } });
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
  }

  const ext = segments[segments.length - 1].split(".").pop()?.toLowerCase() ?? "";
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

  try {
    const data = await getStorage().read(segments.join("/"));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentType === "application/octet-stream" ? "attachment" : "inline",
        // Private documents: never shared by a cache, never reinterpreted by the browser.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
