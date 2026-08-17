import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminId } from "@/lib/session";
import { getStorage } from "@/lib/providers/storage";

// Vercel's Serverless Functions hard-cap the request body at ~4.5 MB
// regardless of this value, so the client (FleetBoard.tsx) resizes/recompresses
// photos before upload — this is just a defensive ceiling under that limit.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getCurrentAdminId();
  if (!adminId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const trailer = await prisma.trailer.findUnique({ where: { id } });
  if (!trailer) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Fichier vide ou trop volumineux (max 4 Mo)" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Format d'image non supporté (png, jpg, webp)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `trailers/${id}-${Date.now()}.${EXT_BY_MIME[file.type]}`;
  const { url } = await getStorage().save(path, buffer, file.type);

  const updated = await prisma.trailer.update({ where: { id }, data: { imageUrl: url } });
  return NextResponse.json({ imageUrl: updated.imageUrl });
}
