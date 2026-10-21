export interface SignatureProvider {
  generateContract(p: { reservationId: string }): Promise<{ pdfUrl: string }>;
  captureSignature(p: {
    reservationId: string;
    signatureImageBuffer: Buffer;
    signerName: string;
    signerIp: string;
    // "drawn" on the signature pad, "typed" when the client typed their name instead (the image is then
    // that name set in handwriting).
    method?: "drawn" | "typed";
  }): Promise<{ signatureStatus: "signed"; signedAt: Date; signatureImageUrl: string }>;
}
