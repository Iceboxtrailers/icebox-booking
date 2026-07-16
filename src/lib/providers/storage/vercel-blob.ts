import { put, get } from "@vercel/blob";
import type { Storage } from "./types";

// Production storage backend — Vercel's serverless functions have a
// read-only filesystem (aside from ephemeral /tmp), so uploaded documents,
// generated contract PDFs, and signature images can't live on local disk
// the way LocalFilesystemStorage does. Needs BLOB_READ_WRITE_TOKEN, created
// automatically when a Vercel Blob store is linked to the project.
//
// The store is "private": blobs are not reachable via a guessable public
// URL, only via the authenticated `get()` call below. Our own
// /api/files/[...path] route is what actually enforces per-client ownership
// before it calls read() — this is a second layer, not a substitute for that.
export class VercelBlobStorage implements Storage {
  async save(path: string, data: Buffer, contentType: string): Promise<{ url: string }> {
    await put(path, data, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
    return { url: `/api/files/${path.split("/").map(encodeURIComponent).join("/")}` };
  }

  async read(path: string): Promise<Buffer> {
    const result = await get(path, { access: "private" });
    if (!result?.stream) throw new Error("Fichier introuvable");
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
}
