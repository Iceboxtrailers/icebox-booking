export interface SignatureProvider {
  generateContract(p: { reservationId: string }): Promise<{ pdfUrl: string }>;
  captureSignature(p: {
    reservationId: string;
    signatureImageBuffer: Buffer;
    signerName: string;
    signerIp: string;
  }): Promise<{ signatureStatus: "signed"; signedAt: Date; signatureImageUrl: string }>;
}
