import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/providers/storage";
import { buildContractLines, contractParamsFor } from "./contract-text";
import { renderContractPdf } from "./contract-pdf";
import type { SignatureProvider } from "./types";

// The contract as the terms stand now: the lines the page shows and the PDF prints.
export async function loadContractLines(reservationId: string) {
  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: { client: true, trailer: true },
  });
  if (!reservation.trailer || !reservation.pickupDate || !reservation.returnDate) {
    throw new Error("Reservation is missing trailer or dates");
  }
  return buildContractLines(
    contractParamsFor({
      ...reservation,
      trailer: reservation.trailer,
      pickupDate: reservation.pickupDate,
      returnDate: reservation.returnDate,
    }),
  );
}

// Renders a PDF contract from reservation data (contract-pdf.ts) and keeps the client's signature: drawn on
// the page canvas, or the typed name set in handwriting, both as a PNG. Clearly stamped as a non-binding
// prototype. Swap for src/lib/providers/signature/dropboxsign.ts or docusign.ts once a real e-signature
// account exists — same interface, no call-site changes.
export class StubSignatureProvider implements SignatureProvider {
  async generateContract({ reservationId }: { reservationId: string }) {
    const lines = await loadContractLines(reservationId);
    const pdfBytes = await renderContractPdf(lines);
    const { url } = await getStorage().save(`contracts/${reservationId}.pdf`, Buffer.from(pdfBytes), "application/pdf");

    await prisma.contract.upsert({
      where: { reservationId },
      create: { reservationId, pdfUrl: url },
      update: { pdfUrl: url },
    });

    return { pdfUrl: url };
  }

  async captureSignature({
    reservationId,
    signatureImageBuffer,
    signerName,
    signerIp,
    method = "drawn",
  }: {
    reservationId: string;
    signatureImageBuffer: Buffer;
    signerName: string;
    signerIp: string;
    method?: "drawn" | "typed";
  }) {
    const signedAt = new Date();
    const storage = getStorage();

    // The signed copy replaces the unsigned one: the contract as the terms stand now, dated today, with the
    // signature printed at the end. Nothing is recorded in the database until the file is made.
    const lines = await loadContractLines(reservationId);
    const pdfBytes = await renderContractPdf(lines, {
      signature: { imageBuffer: signatureImageBuffer, signerName, signedAt, method },
    });
    const { url: pdfUrl } = await storage.save(`contracts/${reservationId}.pdf`, Buffer.from(pdfBytes), "application/pdf");
    const { url } = await storage.save(`signatures/${reservationId}.png`, signatureImageBuffer, "image/png");

    const data = { pdfUrl, signatureStatus: "signed", signedAt, signerIp, signerName, signatureImageUrl: url };
    await prisma.contract.upsert({
      where: { reservationId },
      create: { reservationId, ...data },
      update: data,
    });

    return { signatureStatus: "signed" as const, signedAt, signatureImageUrl: url };
  }
}
