import { put, list } from "@vercel/blob";
import type { Storage } from "./types";

// Production storage backend — Vercel's serverless functions have a
// read-only filesystem (aside from ephemeral /tmp), so uploaded documents,
// generated contract PDFs, and signature images can't live on local disk
// the way LocalFilesystemStorage does. Needs BLOB_READ_WRITE_TOKEN, created
// automatically when a Vercel Blob store is linked to the project.
export class VercelBlobStorage implements Storage {
  async save(path: string, data: Buffer, contentType: string): Promise<{ url: string }> {
    await put(path, data, { access: "public", contentType, addRandomSuffix: false });
    return { url: `/api/files/${path.split("/").map(encodeURIComponent).join("/")}` };
  }

  async read(path: string): Promise<Buffer> {
    const { blobs } = await list({ prefix: path, limit: 1 });
    const blob = blobs.find((b) => b.pathname === path);
    if (!blob) throw new Error("Fichier introuvable");
    const res = await fetch(blob.url);
    if (!res.ok) throw new Error("Fichier introuvable");
    return Buffer.from(await res.arrayBuffer());
  }
}
