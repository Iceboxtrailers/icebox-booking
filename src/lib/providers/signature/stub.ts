import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/providers/storage";
import { CONTRACT_PAGE_COUNT, buildContractLines, contractParamsFor } from "./contract-text";
import { renderContractDocument, type SignatureStamp } from "./contract-pdf";
import type { SignatureProvider } from "./types";

async function loadContractParams(reservationId: string) {
  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: { client: true, trailer: true },
  });
  if (!reservation.trailer || !reservation.pickupDate || !reservation.returnDate) {
    throw new Error("Reservation is missing trailer or dates");
  }
  return contractParamsFor({
    ...reservation,
    trailer: reservation.trailer,
    pickupDate: reservation.pickupDate,
    returnDate: reservation.returnDate,
  });
}

// The contract as the terms stand now: the blocks the page shows and the PDF prints.
export async function loadContractLines(reservationId: string, pageCount = CONTRACT_PAGE_COUNT) {
  return buildContractLines({ ...(await loadContractParams(reservationId)), pageCount });
}

// The PDF of the contract as the terms stand now. The text counts its own pages ("les cinq pages du présent
// contrat"): should the layout come out with another number, the text is built again with it, so the two agree.
async function renderCurrentContract(reservationId: string, signature?: SignatureStamp): Promise<Uint8Array> {
  const params = await loadContractParams(reservationId);
  let pageCount = CONTRACT_PAGE_COUNT;
  for (let attempt = 0; ; attempt++) {
    const rendered = await renderContractDocument(buildContractLines({ ...params, pageCount }), { signature });
    if (rendered.pageCount === pageCount || attempt === 2) return rendered.bytes;
    pageCount = rendered.pageCount;
  }
}

// Renders a PDF contract from reservation data (contract-pdf.ts) and keeps the client's signature: drawn on
// the page canvas, or the typed name set in handwriting, both as a PNG, with who and when printed in the
// contract's signature block. Swap for src/lib/providers/signature/dropboxsign.ts or docusign.ts if a third-party e-signature
// service is ever wanted — same interface, no call-site changes.
export class StubSignatureProvider implements SignatureProvider {
  async generateContract({ reservationId }: { reservationId: string }) {
    const pdfBytes = await renderCurrentContract(reservationId);
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

    // The signed copy replaces the unsigned one: the contract as the terms stand now, with the signature
    // printed in its signature block. Nothing is recorded in the database until the file is made.
    const pdfBytes = await renderCurrentContract(reservationId, {
      imageBuffer: signatureImageBuffer,
      signerName,
      signedAt,
      method,
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
