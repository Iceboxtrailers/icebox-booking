import { LocalFilesystemStorage } from "./local";
import { VercelBlobStorage } from "./vercel-blob";
import type { Storage } from "./types";

export type { Storage };

let instance: Storage | null = null;

export function getStorage(): Storage {
  if (!instance) {
    instance = process.env.STORAGE_PROVIDER === "vercel-blob" ? new VercelBlobStorage() : new LocalFilesystemStorage();
  }
  return instance;
}
