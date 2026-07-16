import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/providers/storage";
import { buildContractText } from "./contract-text";
import { wrapText } from "./wrap-text";
import type { SignatureProvider } from "./types";

// Renders a PDF contract from reservation data and captures the on-page
// canvas signature as a PNG. Clearly stamped as a non-binding prototype.
// Swap for src/lib/providers/signature/dropboxsign.ts or docusign.ts once a
// real e-signature account exists — same interface, no call-site changes.
export class StubSignatureProvider implements SignatureProvider {
  async generateContract({ reservationId }: { reservationId: string }) {
    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: { client: true, trailer: true },
    });
    if (!reservation.trailer || !reservation.pickupDate || !reservation.returnDate) {
      throw new Error("Reservation is missing trailer or dates");
    }

    const start = reservation.pickupDate.toISOString().slice(0, 10);
    const end = reservation.returnDate.toISOString().slice(0, 10);

    const paragraph = buildContractText({
      firstName: reservation.client.firstName,
      lastName: reservation.client.lastName,
      trailerType: reservation.trailer.type,
      trailerSize: reservation.trailer.size,
      start,
      end,
      dailyRateCents: reservation.trailer.dailyRate,
      totalCents: reservation.totalAmount,
    });

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 56;
    const maxWidth = page.getWidth() - margin * 2;
    let y = page.getHeight() - margin;

    page.drawText("PROTOTYPE — NON LÉGALEMENT CONTRAIGNANT", {
      x: margin,
      y,
      size: 10,
      font: boldFont,
      color: rgb(0.75, 0.25, 0.05),
    });
    y -= 28;

    page.drawText("Contrat de location — aperçu généré", { x: margin, y, size: 14, font: boldFont });
    y -= 24;

    for (const line of wrapText(paragraph, font, 11, maxWidth)) {
      page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.15, 0.17, 0.2) });
      y -= 16;
    }

    const pdfBytes = await pdfDoc.save();
    const { url } = await getStorage().save(
      `contracts/${reservationId}.pdf`,
      Buffer.from(pdfBytes),
      "application/pdf"
    );

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
  }: {
    reservationId: string;
    signatureImageBuffer: Buffer;
    signerName: string;
    signerIp: string;
  }) {
    const { url } = await getStorage().save(
      `signatures/${reservationId}.png`,
      signatureImageBuffer,
      "image/png"
    );
    const signedAt = new Date();

    await prisma.contract.upsert({
      where: { reservationId },
      create: {
        reservationId,
        signatureStatus: "signed",
        signedAt,
        signerIp,
        signerName,
        signatureImageUrl: url,
      },
      update: {
        signatureStatus: "signed",
        signedAt,
        signerIp,
        signerName,
        signatureImageUrl: url,
      },
    });

    return { signatureStatus: "signed" as const, signedAt, signatureImageUrl: url };
  }
}
