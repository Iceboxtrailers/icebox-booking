import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/providers/storage";
import { buildContractLines } from "./contract-text";
import { wrapText } from "./wrap-text";
import type { SignatureProvider } from "./types";
import type { TrailerSize } from "@/lib/constants";

const PAGE_SIZE: [number, number] = [612, 792];
const MARGIN = 56;
const LOGO_PATH = path.join(process.cwd(), "public/brand/logo-horizontal.png");
// The logo sits beside the "Entre les parties" header block (Locateur/Locataire),
// sized to roughly fill that block's height, capped so it never overwhelms the page.
const LOGO_MAX_HEIGHT = 140;
const LOGO_MIN_HEIGHT = 60;
const LOGO_COLUMN_WIDTH = 150; // reserved on the right so header text wraps around it

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
    const drawWrapped = (
      text: string,
      size: number,
      useFont: PDFFont,
      width = maxWidth,
      x = MARGIN,
      color = rgb(0.15, 0.17, 0.2)
    ) => {
      for (const wline of wrapText(text, useFont, size, width)) {
        ensureRoom(size + 4);
        page.drawText(wline, { x, y, size, font: useFont, color });
        y -= size + 4;
      }
    };
    const drawRule = () => {
      ensureRoom(10);
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: MARGIN + maxWidth, y },
        thickness: 0.75,
        color: rgb(0.8, 0.8, 0.8),
      });
      y -= 10;
    };
    const renderLine = (line: (typeof lines)[number], width = maxWidth) => {
      if (line.type === "title") {
        ensureRoom(20);
        drawWrapped(line.text, 15, boldFont, width);
        y -= 6;
      } else if (line.type === "heading") {
        ensureRoom(18);
        y -= 4;
        drawWrapped(line.text, 12.5, boldFont, width);
      } else if (line.type === "subheading") {
        ensureRoom(15);
        drawWrapped(line.text, 11, boldFont, width);
      } else if (line.type === "body") {
        drawWrapped(line.text, 10.5, font, width);
      } else if (line.type === "bullet") {
        ensureRoom(14.5);
        page.drawText("•", { x: MARGIN, y, size: 10.5, font, color: rgb(0.15, 0.17, 0.2) });
        drawWrapped(line.text, 10.5, font, width - 12, MARGIN + 12);
      } else if (line.type === "rule") {
        drawRule();
      } else {
        y -= 8;
      }
    };

    // Header ("Entre les parties" through the client's email) is laid out in a
    // narrower left column so the logo can sit large beside it, matching the
    // real IceBox contract template — everything from "1. Objet…" on uses the
    // full page width via the generic loop below.
    const firstHeadingIndex = lines.findIndex((l) => l.type === "heading");
    const headerLines = firstHeadingIndex >= 0 ? lines.slice(0, firstHeadingIndex) : lines;
    const bodyLines = firstHeadingIndex >= 0 ? lines.slice(firstHeadingIndex) : [];

    const headerTopY = y;
    for (const line of headerLines) renderLine(line, maxWidth - LOGO_COLUMN_WIDTH);
    const headerBottomY = y;

    const logoImage = await pdfDoc.embedPng(await readFile(LOGO_PATH));
    const logoHeight = Math.min(LOGO_MAX_HEIGHT, Math.max(headerTopY - headerBottomY, LOGO_MIN_HEIGHT));
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    page.drawImage(logoImage, {
      x: page.getWidth() - MARGIN - logoWidth,
      y: headerTopY - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
    y = Math.min(headerBottomY, headerTopY - logoHeight) - 8;
    drawRule();

    for (const line of bodyLines) renderLine(line);

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
