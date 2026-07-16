import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, normalize, resolve } from "node:path";
import type { Storage } from "./types";

const UPLOADS_ROOT = resolve(process.cwd(), "uploads");

function resolveSafePath(path: string): string {
  const full = resolve(UPLOADS_ROOT, normalize(path));
  if (!full.startsWith(UPLOADS_ROOT)) {
    throw new Error("Invalid storage path");
  }
  return full;
}

// Local-filesystem stub. Swap for src/lib/providers/storage/s3.ts (same
// interface) once encrypted cloud storage credentials exist.
export class LocalFilesystemStorage implements Storage {
  async save(path: string, data: Buffer): Promise<{ url: string }> {
    const fullPath = resolveSafePath(path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
    return { url: `/api/files/${path.split("/").map(encodeURIComponent).join("/")}` };
  }

  async read(path: string): Promise<Buffer> {
    return readFile(resolveSafePath(path));
  }
}

export { UPLOADS_ROOT };
