import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/providers/storage";
import { buildContractLines } from "./contract-text";
import { renderContractPdf } from "./contract-pdf";
import type { SignatureProvider } from "./types";
import type { TrailerSize } from "@/lib/constants";

// Renders a PDF contract from reservation data (contract-pdf.ts) and keeps the client's signature: drawn on
// the page canvas, or the typed name set in handwriting, both as a PNG. Clearly stamped as a non-binding
// prototype. Swap for src/lib/providers/signature/dropboxsign.ts or docusign.ts once a real e-signature
// account exists — same interface, no call-site changes.
export class StubSignatureProvider implements SignatureProvider {
  // The contract as the terms stand now: the lines the page shows and the PDF prints.
  private async loadContractLines(reservationId: string) {
    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: { client: true, trailer: true },
    });
    if (!reservation.trailer || !reservation.pickupDate || !reservation.returnDate) {
      throw new Error("Reservation is missing trailer or dates");
    }

    const start = reservation.pickupDate.toISOString().slice(0, 10);
    const end = reservation.returnDate.toISOString().slice(0, 10);

    return buildContractLines({
      firstName: reservation.client.firstName,
      lastName: reservation.client.lastName,
      company: reservation.client.company,
      email: reservation.client.email,
      phone: reservation.client.phone,
      billingAddress: reservation.client.billingAddress,
      billingCity: reservation.client.billingCity,
      billingProvince: reservation.client.billingProvince,
      billingPostalCode: reservation.client.billingPostalCode,
      trailerSize: reservation.trailer.size as TrailerSize,
      start,
      end,
      totalCents: reservation.totalAmount,
      usageLocation: reservation.usageLocation,
    });
  }

  async generateContract({ reservationId }: { reservationId: string }) {
    const lines = await this.loadContractLines(reservationId);
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
    const lines = await this.loadContractLines(reservationId);
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
