// Shared by the signature pad (browser) and the signing route (server), so both agree on what counts.

// "drawn": the client drew on the signature pad. "typed": the client typed their name, which is then set in
// handwriting; the image the server receives is that name.
export const SIGNATURE_METHOD = ["drawn", "typed"] as const;
export type SignatureMethod = (typeof SIGNATURE_METHOD)[number];

// The signature image goes up as base64 (about a third larger than the image it carries).
export const MAX_SIGNATURE_BYTES = 300 * 1024;

// A typed name is the signature itself: a few letters at least, not "x".
export const MIN_TYPED_SIGNATURE_LENGTH = 3;

// The name as it is set in handwriting: no leading or trailing space, runs of spaces collapsed.
export function typedSignatureText(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function isTypedSignatureValid(name: string): boolean {
  return typedSignatureText(name).length >= MIN_TYPED_SIGNATURE_LENGTH;
}
