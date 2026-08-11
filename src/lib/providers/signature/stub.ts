import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/providers/storage";
import { buildContractLines } from "./contract-text";
import { wrapText } from "./wrap-text";
import type { SignatureProvider } from "./types";
import type { TrailerSize } from "@/lib/constants";

const PAGE_SIZE: [number, number] = [612, 792];
const MARGIN = 56;

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

    const lines = buildContractLines({
      firstName: reservation.client.firstName,
      lastName: reservation.client.lastName,
      company: reservation.client.company,
      email: reservation.client.email,
      phone: reservation.client.phone,
      trailerSize: reservation.trailer.size as TrailerSize,
      start,
      end,
      totalCents: reservation.totalAmount,
      billingAddress: reservation.client.billingAddress,
      billingCity: reservation.client.billingCity,
      billingProvince: reservation.client.billingProvince,
      billingPostalCode: reservation.client.billingPostalCode,
    });

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const maxWidth = PAGE_SIZE[0] - MARGIN * 2;

    let page = pdfDoc.addPage(PAGE_SIZE);
    let y = page.getHeight() - MARGIN;

    page.drawText("PROTOTYPE — NON LÉGALEMENT CONTRAIGNANT", {
      x: MARGIN,
      y,
      size: 9,
      font: boldFont,
      color: rgb(0.75, 0.25, 0.05),
    });
    y -= 22;

    const newPage = () => {
      page = pdfDoc.addPage(PAGE_SIZE);
      y = page.getHeight() - MARGIN;
    };
    const ensureRoom = (needed: number) => {
      if (y - needed < MARGIN) newPage();
    };
    const drawWrapped = (text: string, size: number, useFont: PDFFont, color = rgb(0.15, 0.17, 0.2)) => {
      for (const line of wrapText(text, useFont, size, maxWidth)) {
        ensureRoom(size + 4);
        page.drawText(line, { x: MARGIN, y, size, font: useFont, color });
        y -= size + 4;
      }
    };

    for (const line of lines) {
      if (line.type === "title") {
        ensureRoom(20);
        drawWrapped(line.text, 15, boldFont);
        y -= 6;
      } else if (line.type === "heading") {
        ensureRoom(18);
        y -= 4;
        drawWrapped(line.text, 12.5, boldFont);
      } else if (line.type === "subheading") {
        ensureRoom(15);
        drawWrapped(line.text, 11, boldFont);
      } else if (line.type === "body") {
        drawWrapped(line.text, 10.5, font);
      } else {
        y -= 8;
      }
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
