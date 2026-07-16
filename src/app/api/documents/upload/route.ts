import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { getStorage } from "@/lib/providers/storage";
import { DOCUMENT_TYPE } from "@/lib/constants";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  return "bin";
}

export async function POST(request: Request) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const formData = await request.formData();
  const type = formData.get("type");
  const consent = formData.get("consent");
  const file = formData.get("file");

  if (typeof type !== "string" || !DOCUMENT_TYPE.includes(type as (typeof DOCUMENT_TYPE)[number])) {
    return NextResponse.json({ error: "Type de document invalide" }, { status: 400 });
  }
  if (consent !== "true") {
    return NextResponse.json({ error: "Le consentement est requis" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Fichier vide ou trop volumineux (max 10 Mo)" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Format de fichier non supporté" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `documents/${clientId}/${type}-${Date.now()}.${extensionFor(file)}`;
  const { url } = await getStorage().save(path, buffer, file.type);

  const document = await prisma.document.create({
    data: {
      clientId,
      type,
      encryptedFileUrl: url,
      consentAt: new Date(),
    },
  });

  return NextResponse.json({ id: document.id, url });
}
