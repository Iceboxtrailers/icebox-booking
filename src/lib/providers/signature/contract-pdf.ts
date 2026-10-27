import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { fmt, quebecDay } from "@/lib/dates";
import { pdfText } from "@/lib/pdf-text";
import type { ContractLine } from "./contract-text";
import { wrapText } from "./wrap-text";

const PAGE_SIZE: [number, number] = [612, 792];
const MARGIN = 56;
const LOGO_PATH = path.join(process.cwd(), "public/brand/logo-horizontal.png");
// The logo sits beside the "Entre les parties" header block (Locateur/Locataire),
// sized to roughly fill that block's height, capped so it never overwhelms the page.
const LOGO_MAX_HEIGHT = 140;
const LOGO_MIN_HEIGHT = 60;
const LOGO_COLUMN_WIDTH = 150; // reserved on the right so header text wraps around it

// Room the "Signatures" section needs (date, both parties), and the client's signature block on top once signed.
// They stay together on one page: a name must never be alone on a page of its own.
const SIGNATURES_SECTION_HEIGHT = 130;
const SIGNATURE_STAMP_HEIGHT = 130;

const INK = rgb(0.15, 0.17, 0.2);
const RULE = rgb(0.8, 0.8, 0.8);

// How the client signed, printed under the contract: the signature itself (drawn, or the typed name set in
// handwriting) with who, when and how.
export type SignatureStamp = {
  imageBuffer: Buffer;
  signerName: string;
  signedAt: Date;
  method: "drawn" | "typed";
};

// "21 h 30": the time of day in Québec, written the way the contract writes the date.
export function quebecTimeOfDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour} h ${minute}`;
}

// Draws the contract as a PDF from its lines (the same lines the page shows, see contract-text.ts), with the
// signature block at the end once it is signed. Text goes through pdfText(): a name or an address the PDF font
// cannot draw must not make the contract fail.
export async function renderContractPdf(lines: ContractLine[], options: { signature?: SignatureStamp } = {}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_SIZE[0] - MARGIN * 2;

  let page = pdfDoc.addPage(PAGE_SIZE);
  let y = page.getHeight() - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage(PAGE_SIZE);
    y = page.getHeight() - MARGIN;
  };
  const ensureRoom = (needed: number) => {
    if (y - needed < MARGIN) newPage();
  };
  const drawWrapped = (text: string, size: number, useFont: PDFFont, width = maxWidth, x = MARGIN, color = INK) => {
    for (const wline of wrapText(pdfText(text), useFont, size, width)) {
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
      color: RULE,
    });
    y -= 10;
  };
  const renderLine = (line: ContractLine, width = maxWidth) => {
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
      page.drawText("•", { x: MARGIN, y, size: 10.5, font, color: INK });
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

  const signaturesAt = bodyLines.findLastIndex((line) => line.type === "heading" && line.text === "Signatures");
  bodyLines.forEach((line, index) => {
    if (index === signaturesAt) ensureRoom(SIGNATURES_SECTION_HEIGHT + (options.signature ? SIGNATURE_STAMP_HEIGHT : 0));
    renderLine(line);
  });

  if (options.signature) {
    const { imageBuffer, signerName, signedAt, method } = options.signature;
    const signature = await pdfDoc.embedPng(imageBuffer);
    const box = { width: 190, height: 56 };
    const scale = Math.min(box.width / signature.width, box.height / signature.height);
    const imageWidth = signature.width * scale;
    const imageHeight = signature.height * scale;

    const textX = MARGIN + 10 + box.width + 16;
    const textWidth = MARGIN + maxWidth - 10 - textX;
    const stamp: { text: string; font: PDFFont }[] = [
      { text: "Signé électroniquement", font: boldFont },
      ...wrapText(pdfText(`par ${signerName}`), font, 9.5, textWidth).map((text) => ({ text, font })),
      { text: `le ${fmt(quebecDay(signedAt))} à ${quebecTimeOfDay(signedAt)} (heure du Québec)`, font },
      { text: method === "typed" ? "Nom tapé par le signataire" : "Signature dessinée par le signataire", font },
    ];
    const lineHeight = 13;
    const blockHeight = Math.max(box.height, stamp.length * lineHeight) + 20;

    y -= 10;
    ensureRoom(blockHeight + 4);
    page.drawRectangle({ x: MARGIN, y: y - blockHeight, width: maxWidth, height: blockHeight, borderColor: RULE, borderWidth: 0.75 });
    page.drawImage(signature, { x: MARGIN + 10, y: y - 10 - imageHeight, width: imageWidth, height: imageHeight });
    let textY = y - 10 - 9.5;
    for (const entry of stamp) {
      page.drawText(entry.text, { x: textX, y: textY, size: 9.5, font: entry.font, color: INK });
      textY -= lineHeight;
    }
    y -= blockHeight + 6;
  }

  return pdfDoc.save();
}
