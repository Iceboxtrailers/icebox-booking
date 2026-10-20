// What an uploaded file really is, judged by its first bytes rather than by the type or the name the
// browser claims. Only the formats the site accepts are recognised.
export type DetectedFile = { mime: "image/png" | "image/jpeg" | "image/webp" | "application/pdf"; ext: "png" | "jpg" | "webp" | "pdf" };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function isPng(data: Buffer): boolean {
  return data.length >= PNG_SIGNATURE.length && data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

export function detectFileType(data: Buffer): DetectedFile | null {
  if (isPng(data)) return { mime: "image/png", ext: "png" };
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  if (data.length >= 5 && data.toString("ascii", 0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return null;
}
