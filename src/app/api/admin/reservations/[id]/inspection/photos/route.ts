import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getStorage } from "@/lib/providers/storage";
import { MAX_INSPECTION_PHOTOS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const { admin } = guard;

  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { returnInspection: true } });
  if (!reservation) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (reservation.status !== "confirmed" && reservation.status !== "in_progress") {
    return NextResponse.json({ error: "La réservation n'est pas en cours" }, { status: 409 });
  }
  if (reservation.returnInspection?.status === "accepted") {
    return NextResponse.json({ error: "L'inspection est déjà acceptée" }, { status: 409 });
  }
  if ((reservation.returnInspection?.photoPaths.length ?? 0) >= MAX_INSPECTION_PHOTOS) {
    return NextResponse.json({ error: `Maximum ${MAX_INSPECTION_PHOTOS} photos` }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Photo requise" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Photo vide ou trop volumineuse (max 10 Mo)" }, { status: 400 });
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) return NextResponse.json({ error: "Format non supporté (JPEG, PNG ou WebP)" }, { status: 400 });

  const path = `inspections/${id}/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  await getStorage().save(path, Buffer.from(await file.arrayBuffer()), file.type);

  const inspection = await prisma.returnInspection.upsert({
    where: { reservationId: id },
    create: { reservationId: id, photoPaths: [path] },
    update: { photoPaths: { push: path } },
  });
  await logAudit({
    action: "inspection_photo_added",
    reservationId: id,
    actor: { type: "admin", id: admin.id },
    details: { path },
  });

  return NextResponse.json({ path, photoPaths: inspection.photoPaths });
}
