import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { getStorage } from "@/lib/providers/storage";
import { DOCUMENT_TYPE } from "@/lib/constants";
import { detectFileType } from "@/lib/file-type";
import { RATE_RULES, rejectIfOverLimit } from "@/lib/rate-limit";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
// A client needs a licence and an insurance proof; the rest is room for retries.
const MAX_DOCUMENTS_PER_CLIENT = 12;

export async function POST(request: Request) {
  const clientId = await getCurrentClientId();
  if (!clientId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const limited = await rejectIfOverLimit(RATE_RULES.upload, clientId);
  if (limited) return limited;

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

  const buffer = Buffer.from(await file.arrayBuffer());
  // The type and name sent by the browser are not trusted: the file itself decides.
  const detected = detectFileType(buffer);
  if (!detected) {
    return NextResponse.json({ error: "Format de fichier non supporté (photo JPG, PNG, WebP ou PDF)" }, { status: 400 });
  }

  if ((await prisma.document.count({ where: { clientId } })) >= MAX_DOCUMENTS_PER_CLIENT) {
    return NextResponse.json({ error: "Nombre maximal de documents atteint. Communiquez avec IceBox." }, { status: 429 });
  }

  const path = `documents/${clientId}/${type}-${Date.now()}-${randomBytes(3).toString("hex")}.${detected.ext}`;
  const { url } = await getStorage().save(path, buffer, detected.mime);

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
