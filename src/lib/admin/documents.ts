import { prisma } from "@/lib/prisma";

export type ClientDocument = {
  id: string;
  type: string;
  // Path of the private file (opened through /api/files, which checks who is asking).
  url: string;
  uploadedAt: string;
  verificationStatus: string;
};

// The licence and insurance proofs a client uploaded, newest first.
export async function getClientDocuments(clientId: string): Promise<ClientDocument[]> {
  const rows = await prisma.document.findMany({
    where: { clientId },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, type: true, encryptedFileUrl: true, uploadedAt: true, verificationStatus: true },
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    url: row.encryptedFileUrl,
    uploadedAt: row.uploadedAt.toISOString(),
    verificationStatus: row.verificationStatus,
  }));
}
