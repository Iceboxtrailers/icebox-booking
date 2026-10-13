import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Encrypts third-party tokens at rest. The key is derived from AUTH_SECRET so no
// extra secret has to be managed — rotating AUTH_SECRET invalidates stored tokens
// (QuickBooks would then simply need to be reconnected).
function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET n'est pas configuré");
  return Buffer.from(hkdfSync("sha256", secret, "icebox", "third-party-token-encryption", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(boxed: string): string {
  const [iv, tag, encrypted] = boxed.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !encrypted) throw new Error("Jeton chiffré invalide");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
